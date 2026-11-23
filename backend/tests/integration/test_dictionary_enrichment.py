"""The versioned enrichment pass against a real MySQL.

A re-run updates dictionary rows in place: row ids survive, no duplicate rows
appear, and the study items and their history that reference the rows are
untouched.
"""

from __future__ import annotations

import json

import httpx
from opentelemetry.metrics import NoOpMeter
from sqlalchemy import text

from shougong.application.container import Container
from shougong.persistence.dictionary.repository import DictionaryRepository
from shougong.usecase.dictionary.model import HskDatasetWord
from shougong.usecase.dictionary.service import DictionaryService
from shougong.usecase.dictionary.telemetry import DictionaryTelemetry
from tests.fixtures import FakeHskDatasetSource

_SEED = [
    {"s": "行", "p": "xing2", "d": ["to walk"]},
    {"s": "行", "p": "hang2", "d": ["firm"]},
    {"s": "水", "p": "shui3", "d": ["water"]},
]

type _EntryRow = tuple[int, str, str, int | None, str]


def _service(container: Container, *, version: int) -> DictionaryService:
    return DictionaryService(
        DictionaryRepository(container.transaction_template),
        DictionaryTelemetry(NoOpMeter("test")),
        enrichment_version=version,
    )


async def _seed(container: Container) -> dict[str, int]:
    async with container.engine.begin() as conn:
        await conn.execute(
            text("INSERT INTO dictionary_entry (simplified, pinyin, definitions) VALUES (:s, :p, :d)"),
            [{"s": row["s"], "p": row["p"], "d": json.dumps(row["d"])} for row in _SEED],
        )
        rows = (await conn.execute(text("SELECT id, simplified, pinyin FROM dictionary_entry"))).all()
    return {f"{simplified}|{pinyin}": entry_id for entry_id, simplified, pinyin in rows}


async def _entry_rows(container: Container) -> list[_EntryRow]:
    async with container.engine.connect() as conn:
        rows = (
            await conn.execute(
                text("SELECT id, simplified, pinyin, hsk_level, pos_tags FROM dictionary_entry ORDER BY id")
            )
        ).all()
    return [(int(row[0]), row[1], row[2], row[3], row[4]) for row in rows]


def _stamped(rows: list[_EntryRow]) -> dict[int, tuple[int | None, object]]:
    return {row[0]: (row[3], json.loads(row[4])) for row in rows if row[1] == "行"}


async def _history_rows(container: Container, study_item_id: int) -> list[tuple[object, ...]]:
    async with container.engine.connect() as conn:
        rows = (
            await conn.execute(
                text(
                    "SELECT id, study_item_id, entry_id, card_state, card_due, created_at "
                    "FROM study_item_history WHERE study_item_id = :id ORDER BY id"
                ),
                {"id": study_item_id},
            )
        ).all()
    return [tuple(row) for row in rows]


async def test_advancing_the_version_updates_rows_in_place_and_keeps_study_history(
    container: Container, client: httpx.AsyncClient
) -> None:
    ids = await _seed(container)
    item = (await client.post("/study-items", json={"dictionary_entry_id": ids["行|xing2"]})).json()
    await client.post(f"/study-items/{item['id']}/reviews", json={"rating": "good"})

    entry_ids_before = [row[0] for row in await _entry_rows(container)]
    history_before = await _history_rows(container, item["id"])
    repository = DictionaryRepository(container.transaction_template)

    first = FakeHskDatasetSource({"行": HskDatasetWord("行", 2, ("v", "n"))})
    assert await _service(container, version=1).enrich_hsk(first) == 1
    assert await repository.enrichment_version() == 1
    assert _stamped(await _entry_rows(container)) == {
        ids["行|xing2"]: (2, ["v", "n"]),
        ids["行|hang2"]: (2, ["v", "n"]),
    }

    same_version = FakeHskDatasetSource({"行": HskDatasetWord("行", 5, ("n",))})
    assert await _service(container, version=1).enrich_hsk(same_version) == 0
    assert same_version.fetch_calls == 0

    advanced = FakeHskDatasetSource({"行": HskDatasetWord("行", 5, ("n",))})
    assert await _service(container, version=2).enrich_hsk(advanced) == 1
    assert await repository.enrichment_version() == 2

    after = await _entry_rows(container)
    assert [row[0] for row in after] == entry_ids_before  # same rows, no duplicates
    assert _stamped(after) == {
        ids["行|xing2"]: (5, ["n"]),
        ids["行|hang2"]: (5, ["n"]),
    }
    assert await _history_rows(container, item["id"]) == history_before

    stored_item = (await client.get(f"/study-items/{item['id']}")).json()
    assert stored_item["entry"]["id"] == ids["行|xing2"]


_CLEANUP_SEED = [
    {"s": "吃", "p": "chi1", "d": ["to eat"]},
    {"s": "吃", "p": "chi1", "d": ["variant of 吃[chi1]"]},
    {"s": "水", "p": "shui3", "d": ["water"]},
    {"s": "水", "p": "shui3", "d": ["water"]},
    {"s": "㑳", "p": "zhou4", "d": ["old variant of 媰[zhou4]"]},
]

type _CleanupRow = tuple[int, str, str, tuple[str, ...]]


async def _insert_cleanup_seed(container: Container) -> list[_CleanupRow]:
    async with container.engine.begin() as conn:
        await conn.execute(
            text("INSERT INTO dictionary_entry (simplified, pinyin, definitions) VALUES (:s, :p, :d)"),
            [{"s": row["s"], "p": row["p"], "d": json.dumps(row["d"])} for row in _CLEANUP_SEED],
        )
    return await _cleanup_rows(container)


async def _cleanup_rows(container: Container) -> list[_CleanupRow]:
    async with container.engine.connect() as conn:
        rows = (
            await conn.execute(text("SELECT id, simplified, pinyin, definitions FROM dictionary_entry ORDER BY id"))
        ).all()
    return [(int(row[0]), row[1], row[2], tuple(json.loads(row[3]))) for row in rows]


async def test_the_versioned_pass_cleans_alias_and_duplicate_rows_and_keeps_history(
    container: Container, client: httpx.AsyncClient
) -> None:
    seeded = await _insert_cleanup_seed(container)
    by_definitions = {row[3]: row[0] for row in seeded}
    real_eat = by_definitions[("to eat",)]
    alias_eat = by_definitions[("variant of 吃[chi1]",)]
    first_water = next(row[0] for row in seeded if row[1] == "水")
    variant_only = by_definitions[("old variant of 媰[zhou4]",)]

    item = (await client.post("/study-items", json={"dictionary_entry_id": real_eat})).json()
    await client.post(f"/study-items/{item['id']}/reviews", json={"rating": "good"})
    history_before = await _history_rows(container, item["id"])

    applied = await _service(container, version=1).enrich_hsk(
        FakeHskDatasetSource({"吃": HskDatasetWord("吃", 1, ("v",))})
    )

    assert applied == 1
    # the alias and the byte-identical duplicate are gone; the real 吃, the first
    # 水 and the variant-only 㑳 keep their original ids
    assert await _cleanup_rows(container) == [
        (real_eat, "吃", "chi1", ("to eat",)),
        (first_water, "水", "shui3", ("water",)),
        (variant_only, "㑳", "zhou4", ("old variant of 媰[zhou4]",)),
    ]
    assert alias_eat not in {row[0] for row in await _cleanup_rows(container)}
    assert await _history_rows(container, item["id"]) == history_before
    stored_item = (await client.get(f"/study-items/{item['id']}")).json()
    assert stored_item["entry"]["id"] == real_eat
