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
from shougong.usecase.dictionary.model import HskCharacter, HskDatasetWord
from shougong.usecase.dictionary.service import DictionaryService
from shougong.usecase.dictionary.telemetry import DictionaryTelemetry
from tests.fixtures import FakeHskCharacterSource, FakeHskDatasetSource

_SEED = [
    {"s": "行", "p": "xing2", "d": ["to walk"]},
    {"s": "行", "p": "hang2", "d": ["firm"]},
    {"s": "水", "p": "shui3", "d": ["water"]},
]

type _EntryRow = tuple[int, str, str, int | None, str, int | None]


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
                text(
                    "SELECT id, simplified, pinyin, hsk_level, pos_tags, handwriting_level "
                    "FROM dictionary_entry ORDER BY id"
                )
            )
        ).all()
    return [(int(row[0]), row[1], row[2], row[3], row[4], row[5]) for row in rows]


def _stamped(rows: list[_EntryRow]) -> dict[int, tuple[int | None, object]]:
    return {row[0]: (row[3], json.loads(row[4])) for row in rows if row[1] == "行"}


def _handwriting(rows: list[_EntryRow]) -> dict[str, int | None]:
    return {row[1]: row[5] for row in rows}


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
    characters = FakeHskCharacterSource({"行": HskCharacter("行", 3), "水": HskCharacter("水", 1)})
    assert await _service(container, version=1).enrich_hsk(first, characters) == 1
    assert await repository.enrichment_version() == 1
    assert _stamped(await _entry_rows(container)) == {
        ids["行|xing2"]: (2, ["v", "n"]),
        ids["行|hang2"]: (2, ["v", "n"]),
    }
    assert _handwriting(await _entry_rows(container)) == {"行": 3, "水": 1}

    same_version = FakeHskDatasetSource({"行": HskDatasetWord("行", 5, ("n",))})
    same_characters = FakeHskCharacterSource({"行": HskCharacter("行", 4)})
    assert await _service(container, version=1).enrich_hsk(same_version, same_characters) == 0
    assert same_version.fetch_calls == 0
    assert same_characters.fetch_calls == 0

    advanced = FakeHskDatasetSource({"行": HskDatasetWord("行", 5, ("n",))})
    advanced_characters = FakeHskCharacterSource({"行": HskCharacter("行", 4)})
    assert await _service(container, version=2).enrich_hsk(advanced, advanced_characters) == 1
    assert await repository.enrichment_version() == 2

    after = await _entry_rows(container)
    assert [row[0] for row in after] == entry_ids_before  # same rows, no duplicates
    assert _stamped(after) == {
        ids["行|xing2"]: (5, ["n"]),
        ids["行|hang2"]: (5, ["n"]),
    }
    assert _handwriting(after) == {"行": 4, "水": None}
    assert await _history_rows(container, item["id"]) == history_before

    stored_item = (await client.get(f"/study-items/{item['id']}")).json()
    assert stored_item["entry"]["id"] == ids["行|xing2"]
    assert stored_item["entry"]["hsk_level"] == 5
    assert stored_item["entry"]["handwriting_level"] == 4
