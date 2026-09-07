from __future__ import annotations

import json

import httpx
from sqlalchemy import text

from shougong.application.container import Container
from shougong.persistence.dictionary.repository import DictionaryRepository
from shougong.usecase.dictionary.model import HskDatasetWord

_SEED = [
    {"s": "学", "p": "xue2", "d": ["to learn", "to study"]},
    {"s": "学习", "p": "xue2 xi2", "d": ["to learn", "to study"]},
    {"s": "水", "p": "shui3", "d": ["water"]},
]


async def _seed(container: Container) -> None:
    async with container.engine.begin() as conn:
        await conn.execute(
            text("INSERT INTO dictionary_entry (simplified, pinyin, definitions) VALUES (:s, :p, :d)"),
            [{"s": row["s"], "p": row["p"], "d": json.dumps(row["d"])} for row in _SEED],
        )


async def test_search_matches_hanzi_and_orders_by_length(container: Container, client: httpx.AsyncClient) -> None:
    await _seed(container)

    response = await client.get("/dictionary-entries", params={"q": "学"})

    assert response.status_code == 200
    assert [row["simplified"] for row in response.json()] == ["学", "学习"]


async def test_get_by_id_returns_entry_and_missing_is_404(container: Container, client: httpx.AsyncClient) -> None:
    await _seed(container)
    listed = (await client.get("/dictionary-entries", params={"q": "shui3"})).json()

    found = await client.get(f"/dictionary-entries/{listed[0]['id']}")
    assert found.status_code == 200
    assert found.json()["definitions"] == ["water"]

    missing = await client.get("/dictionary-entries/999999")
    assert missing.status_code == 404


async def test_apply_hsk_stamps_all_rows_and_hsk_words_dedupes(container: Container) -> None:
    async with container.engine.begin() as conn:
        await conn.execute(
            text("INSERT INTO dictionary_entry (simplified, pinyin, definitions) VALUES (:s, :p, :d)"),
            [
                {"s": "行", "p": "xing2", "d": json.dumps(["to walk"])},
                {"s": "行", "p": "hang2", "d": json.dumps(["firm"])},
                {"s": "水", "p": "shui3", "d": json.dumps(["water"])},
            ],
        )

    repo = DictionaryRepository(container.transaction_template)
    assert await repo.count_with_hsk() == 0

    applied = await repo.apply_hsk({"行": HskDatasetWord("行", 2, ("v", "n"))})
    assert applied == 1
    assert await repo.count_with_hsk() == 2  # both readings of 行

    words = await repo.hsk_words()
    assert [(w.simplified, w.hsk_level, w.pos_tags) for w in words] == [("行", 2, ("v", "n"))]

    entries = await repo.find_by_simplified("行")
    assert all(e.hsk_level == 2 and e.pos_tags == ("v", "n") for e in entries)
