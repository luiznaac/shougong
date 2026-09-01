from __future__ import annotations

import json

import httpx
from sqlalchemy import text

from shougong.application.container import Container

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
