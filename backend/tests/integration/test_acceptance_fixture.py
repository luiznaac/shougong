"""The acceptance fixture against a real MySQL.

Two seams: the writer seeds a clean database exactly once (a re-run is a no-op),
and the seeded rows reach the item index's pages, filters and status chips plus
the item-detail readings, related-entries, history and stroke routes through the
HTTP API.
"""

from __future__ import annotations

from datetime import UTC, datetime

import httpx
from sqlalchemy import func, select

from shougong.acceptance.fixture import DETAIL_WORD, apply_acceptance_fixture, build_fixture
from shougong.application.container import Container
from shougong.application.settings import Settings
from shougong.persistence.dictionary.entity import DictionaryEntryEntity
from shougong.persistence.study.entity import StudyItemEntity, StudyItemPriorityEntity

_NOW = datetime(2026, 6, 1, 12, tzinfo=UTC)


async def _counts(container: Container) -> tuple[int, int, int]:
    async with container.engine.connect() as conn:
        entries = await conn.scalar(select(func.count()).select_from(DictionaryEntryEntity))
        items = await conn.scalar(select(func.count()).select_from(StudyItemEntity))
        pins = await conn.scalar(select(func.count()).select_from(StudyItemPriorityEntity))
    return int(entries or 0), int(items or 0), int(pins or 0)


async def test_fixture_seeds_a_clean_database_and_is_idempotent(
    container: Container,
    settings: Settings,
) -> None:
    plan = build_fixture(_NOW)
    pins = sum(1 for row in plan.study_items if row.priority_position is not None)
    expected = (len(plan.study_items) + len(plan.dictionary_only), len(plan.study_items), pins)

    outcome = await apply_acceptance_fixture(settings, now=_NOW)

    assert outcome.seeded is True
    assert await _counts(container) == expected

    again = await apply_acceptance_fixture(settings, now=_NOW)

    assert again.seeded is False
    assert await _counts(container) == expected


async def test_item_index_pages_and_filters_reach_the_seeded_rows(
    client: httpx.AsyncClient,
    settings: Settings,
) -> None:
    await apply_acceptance_fixture(settings, now=_NOW)
    total = len(build_fixture(_NOW).study_items)

    first_page = (await client.get("/study-items", params={"limit": 24, "offset": 0})).json()
    second_page = (await client.get("/study-items", params={"limit": 24, "offset": 24})).json()

    assert first_page["total"] == total
    assert len(first_page["items"]) == 24
    assert len(second_page["items"]) > 0

    leeches = (await client.get("/study-items", params={"leech": "true"})).json()
    assert leeches["total"] >= 1

    for bucket in (*range(1, 10), "none"):
        page = (await client.get("/study-items", params={"hsk_level": bucket, "limit": 1})).json()
        assert page["total"] >= 1, f"no item for HSK {bucket}"

    for state in ("learning", "review", "relearning"):
        page = (await client.get("/study-items", params={"state": state, "limit": 1})).json()
        assert page["total"] >= 1, f"no item in state {state}"


async def test_item_detail_surfaces_reach_the_seeded_rows(
    client: httpx.AsyncClient,
    settings: Settings,
) -> None:
    await apply_acceptance_fixture(settings, now=_NOW)
    detail = next(row for row in build_fixture(_NOW).study_items if row.entry.simplified == DETAIL_WORD)

    items = (await client.get("/study-items", params={"search": detail.entry.simplified})).json()
    item = items["items"][0]

    # On a clean database the detail word is the first study item, so the
    # runbook's `/biblioteca/itens/1` resolves to it.
    assert item["id"] == 1
    assert item["entry"]["simplified"] == detail.entry.simplified
    assert item["card"]["state"] == "learning"
    assert item["priority_position"] is not None
    entry_id = item["entry"]["id"]

    history = (await client.get(f"/study-items/{item['id']}/history")).json()
    assert len(history) >= 2
    assert history[0]["card"]["stability"] is not None

    readings = (await client.get("/reading-texts", params={"entry_id": entry_id})).json()
    assert readings["total"] >= 2
    assert all(read["match"] is not None and read["match"]["hit"] == DETAIL_WORD for read in readings["items"])
    assert any(read["extra_word_count"] >= 1 for read in readings["items"])

    first = (await client.get(f"/dictionary-entries/{entry_id}/related", params={"limit": 8, "offset": 0})).json()
    second = (await client.get(f"/dictionary-entries/{entry_id}/related", params={"limit": 8, "offset": 8})).json()
    assert first["total"] > 8
    assert len(first["items"]) == 8
    assert second["items"]
    assert any(entry["study_item_id"] is not None for entry in first["items"] + second["items"])

    for character in detail.entry.simplified:
        strokes = await client.get(f"/characters/{character}/strokes")
        assert strokes.status_code == 200
        assert strokes.json()["strokes"]
