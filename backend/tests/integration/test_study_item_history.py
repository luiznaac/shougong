from __future__ import annotations

import json

import httpx
from sqlalchemy import text

from shougong.application.container import Container


async def _seed_entry(container: Container, *, simplified: str, pinyin: str) -> int:
    async with container.engine.begin() as conn:
        result = await conn.execute(
            text("INSERT INTO dictionary_entry (simplified, pinyin, definitions) VALUES (:s, :p, :d)"),
            {"s": simplified, "p": pinyin, "d": json.dumps(["to learn"])},
        )
        return int(result.lastrowid)


async def _add_item(client: httpx.AsyncClient, entry_id: int) -> dict:
    return (await client.post("/study-items", json={"dictionary_entry_id": entry_id})).json()


async def test_a_new_item_has_a_single_creation_history_row(container: Container, client: httpx.AsyncClient) -> None:
    created = await _add_item(client, await _seed_entry(container, simplified="山", pinyin="shan1"))

    history = await client.get(f"/study-items/{created['id']}/history")

    assert history.status_code == 200
    (row,) = history.json()
    assert row["study_item_id"] == created["id"]
    assert row["entry"] == created["entry"]
    assert row["card"] == created["card"]
    assert row["created_at"] == created["created_at"]


async def test_history_of_an_unknown_item_is_404(container: Container, client: httpx.AsyncClient) -> None:
    response = await client.get("/study-items/999999/history")

    assert response.status_code == 404


async def test_review_appends_a_history_row_newest_first(container: Container, client: httpx.AsyncClient) -> None:
    item = await _add_item(client, await _seed_entry(container, simplified="木", pinyin="mu4"))
    review = (await client.post(f"/study-items/{item['id']}/reviews", json={"rating": "good"})).json()

    rows = (await client.get(f"/study-items/{item['id']}/history")).json()

    assert [row["card"]["state"] for row in rows] == ["review", "learning"]  # newest first
    assert all(row["study_item_id"] == item["id"] for row in rows)
    assert rows[0]["card"]["due"] == review["item"]["card"]["due"]
    assert rows[0]["created_at"] == review["review"]["review_datetime"]  # written at the review time
    assert rows[1]["card"]["last_review"] is None  # the creation row
    assert rows[1]["created_at"] == item["created_at"]


async def test_learning_to_review_transitions_list_the_graduation_row_across_items(
    container: Container, client: httpx.AsyncClient
) -> None:
    graduated = await _add_item(client, await _seed_entry(container, simplified="金", pinyin="jin1"))
    still_learning = await _add_item(client, await _seed_entry(container, simplified="石", pinyin="shi2"))
    review = (await client.post(f"/study-items/{graduated['id']}/reviews", json={"rating": "good"})).json()

    transitions = await client.get("/study-items/history/learning-to-review")

    assert transitions.status_code == 200
    rows = transitions.json()
    assert [row["study_item_id"] for row in rows] == [graduated["id"]]  # the still-learning item is absent
    assert rows[0]["card"]["state"] == "review"
    assert rows[0]["card"]["due"] == review["item"]["card"]["due"]
    assert rows[0]["created_at"] == review["review"]["review_datetime"]
    assert still_learning["id"] not in [row["study_item_id"] for row in rows]


async def test_learning_to_review_transitions_paginate_newest_first(
    container: Container, client: httpx.AsyncClient
) -> None:
    graduated: list[int] = []
    for simplified, pinyin in (("东", "dong1"), ("西", "xi1"), ("南", "nan2")):
        item = await _add_item(client, await _seed_entry(container, simplified=simplified, pinyin=pinyin))
        await client.post(f"/study-items/{item['id']}/reviews", json={"rating": "good"})
        graduated.append(item["id"])

    first = await client.get("/study-items/history/learning-to-review", params={"limit": 2, "offset": 0})
    second = await client.get("/study-items/history/learning-to-review", params={"limit": 2, "offset": 2})

    assert [row["study_item_id"] for row in first.json()] == [graduated[2], graduated[1]]
    assert [row["study_item_id"] for row in second.json()] == [graduated[0]]


async def test_learning_to_review_transitions_empty_before_any_review(
    container: Container, client: httpx.AsyncClient
) -> None:
    await _add_item(client, await _seed_entry(container, simplified="北", pinyin="bei3"))

    transitions = await client.get("/study-items/history/learning-to-review")

    assert transitions.status_code == 200
    assert transitions.json() == []
