"""The acceptance fixture against a real MySQL.

Two seams: the writer seeds a clean database exactly once (a re-run is a no-op),
and the seeded rows reach the item index's pages, filters and status chips
through the HTTP API.
"""

from __future__ import annotations

from datetime import UTC, datetime

import httpx
from sqlalchemy import func, select

from shougong.acceptance.fixture import apply_acceptance_fixture, build_fixture
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
    expected = (len(plan.study_items) + len(plan.dictionary_only), len(plan.study_items), 2)

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
