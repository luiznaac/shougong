from __future__ import annotations

import json

import httpx
from sqlalchemy import text

from shougong.application.container import Container


async def _seed_entry(container: Container, *, simplified: str = "学", pinyin: str = "xue2") -> int:
    async with container.engine.begin() as conn:
        result = await conn.execute(
            text("INSERT INTO dictionary_entry (simplified, pinyin, definitions) VALUES (:s, :p, :d)"),
            {"s": simplified, "p": pinyin, "d": json.dumps(["to learn"])},
        )
        return int(result.lastrowid)


async def test_add_lists_and_fetches_a_study_item(container: Container, client: httpx.AsyncClient) -> None:
    entry_id = await _seed_entry(container)

    created = await client.post("/study-items", json={"dictionary_entry_id": entry_id})
    assert created.status_code == 201
    assert created.headers["location"] == f"/study-items/{created.json()['id']}"
    body = created.json()
    assert body["entry"]["id"] == entry_id
    assert body["card"]["state"] == "learning"
    assert body["card"]["due"].endswith("T00:00:00Z")  # snapped to the day boundary

    listed = await client.get("/study-items")
    assert [row["id"] for row in listed.json()] == [body["id"]]

    fetched = await client.get(f"/study-items/{body['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["entry"]["simplified"] == "学"


async def test_new_item_shows_up_as_due(container: Container, client: httpx.AsyncClient) -> None:
    entry_id = await _seed_entry(container, simplified="水", pinyin="shui3")
    await client.post("/study-items", json={"dictionary_entry_id": entry_id})

    due = await client.get("/study-items", params={"due": "true"})

    assert due.status_code == 200
    assert len(due.json()) == 1


async def test_adding_the_same_entry_twice_conflicts(container: Container, client: httpx.AsyncClient) -> None:
    entry_id = await _seed_entry(container, simplified="火", pinyin="huo3")
    await client.post("/study-items", json={"dictionary_entry_id": entry_id})

    again = await client.post("/study-items", json={"dictionary_entry_id": entry_id})

    assert again.status_code == 409


async def test_add_unknown_entry_is_404(container: Container, client: httpx.AsyncClient) -> None:
    response = await client.post("/study-items", json={"dictionary_entry_id": 999999})

    assert response.status_code == 404
