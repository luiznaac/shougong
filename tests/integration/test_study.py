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


async def test_reviewing_an_item_reschedules_it_and_records_history(
    container: Container, client: httpx.AsyncClient
) -> None:
    entry_id = await _seed_entry(container, simplified="木", pinyin="mu4")
    item_id = (await client.post("/study-items", json={"dictionary_entry_id": entry_id})).json()["id"]
    assert len((await client.get("/study-items", params={"due": "true"})).json()) == 1

    reviewed = await client.post(f"/study-items/{item_id}/reviews", json={"rating": "good"})

    assert reviewed.status_code == 201
    assert reviewed.headers["location"] == f"/study-items/{item_id}/reviews"
    body = reviewed.json()
    assert body["review"]["rating"] == "good"
    assert body["item"]["card"]["state"] == "review"
    assert body["item"]["card"]["last_review"] is not None

    # no longer due, and the card moved into the future
    assert (await client.get("/study-items", params={"due": "true"})).json() == []
    fetched = await client.get(f"/study-items/{item_id}")
    assert fetched.json()["card"]["due"] > body["item"]["created_at"]

    history = await client.get(f"/study-items/{item_id}/reviews")
    assert [row["rating"] for row in history.json()] == ["good"]

    item_history = await client.get(f"/study-items/{item_id}/history")
    assert item_history.status_code == 200
    rows = item_history.json()
    assert [row["card"]["state"] for row in rows] == ["review", "learning"]  # newest first
    assert all(row["study_item_id"] == item_id for row in rows)
    assert rows[0]["card"]["due"] == fetched.json()["card"]["due"]
    assert rows[0]["created_at"] == body["review"]["review_datetime"]  # written at the review time
    assert rows[1]["card"]["last_review"] is None  # the creation row
    assert rows[1]["created_at"] == body["item"]["created_at"]


async def test_learning_to_review_transitions_lists_the_graduation_row_across_items(
    container: Container, client: httpx.AsyncClient
) -> None:
    graduated_id = (
        await client.post(
            "/study-items", json={"dictionary_entry_id": await _seed_entry(container, simplified="金", pinyin="jin1")}
        )
    ).json()["id"]
    still_learning_id = (
        await client.post(
            "/study-items", json={"dictionary_entry_id": await _seed_entry(container, simplified="石", pinyin="shi2")}
        )
    ).json()["id"]
    review = (await client.post(f"/study-items/{graduated_id}/reviews", json={"rating": "good"})).json()

    transitions = await client.get("/study-items/history/learning-to-review")

    assert transitions.status_code == 200
    rows = transitions.json()
    assert [row["study_item_id"] for row in rows] == [graduated_id]  # the still-learning item is absent
    assert rows[0]["card"]["state"] == "review"
    assert rows[0]["card"]["due"] == review["item"]["card"]["due"]
    assert rows[0]["created_at"] == review["review"]["review_datetime"]
    assert still_learning_id not in [row["study_item_id"] for row in rows]


async def test_learning_to_review_transitions_paginate_newest_first(
    container: Container, client: httpx.AsyncClient
) -> None:
    graduated: list[int] = []
    for simplified, pinyin in (("東", "dong1"), ("西", "xi1"), ("南", "nan2")):
        entry_id = await _seed_entry(container, simplified=simplified, pinyin=pinyin)
        item_id = (await client.post("/study-items", json={"dictionary_entry_id": entry_id})).json()["id"]
        await client.post(f"/study-items/{item_id}/reviews", json={"rating": "good"})
        graduated.append(item_id)

    first = await client.get("/study-items/history/learning-to-review", params={"limit": 2, "offset": 0})
    second = await client.get("/study-items/history/learning-to-review", params={"limit": 2, "offset": 2})

    assert [row["study_item_id"] for row in first.json()] == [graduated[2], graduated[1]]
    assert [row["study_item_id"] for row in second.json()] == [graduated[0]]


async def test_learning_to_review_transitions_empty_before_any_review(
    container: Container, client: httpx.AsyncClient
) -> None:
    entry_id = await _seed_entry(container, simplified="北", pinyin="bei3")
    await client.post("/study-items", json={"dictionary_entry_id": entry_id})

    transitions = await client.get("/study-items/history/learning-to-review")

    assert transitions.status_code == 200
    assert transitions.json() == []


async def test_reviewing_an_unknown_item_is_404(container: Container, client: httpx.AsyncClient) -> None:
    response = await client.post("/study-items/999999/reviews", json={"rating": "good"})

    assert response.status_code == 404


async def test_history_of_an_unknown_item_is_404(container: Container, client: httpx.AsyncClient) -> None:
    response = await client.get("/study-items/999999/history")

    assert response.status_code == 404


async def test_a_new_item_has_a_single_creation_history_row(container: Container, client: httpx.AsyncClient) -> None:
    entry_id = await _seed_entry(container, simplified="山", pinyin="shan1")
    created = (await client.post("/study-items", json={"dictionary_entry_id": entry_id})).json()

    history = await client.get(f"/study-items/{created['id']}/history")

    assert history.status_code == 200
    (row,) = history.json()
    assert row["study_item_id"] == created["id"]
    assert row["entry"] == created["entry"]
    assert row["card"] == created["card"]
    assert row["created_at"] == created["created_at"]


async def test_reviewing_an_item_that_is_not_due_is_409(container: Container, client: httpx.AsyncClient) -> None:
    entry_id = await _seed_entry(container, simplified="日", pinyin="ri4")
    item_id = (await client.post("/study-items", json={"dictionary_entry_id": entry_id})).json()["id"]
    # first review pushes the card days into the future
    assert (await client.post(f"/study-items/{item_id}/reviews", json={"rating": "good"})).status_code == 201

    again = await client.post(f"/study-items/{item_id}/reviews", json={"rating": "good"})

    assert again.status_code == 409
    assert len((await client.get(f"/study-items/{item_id}/reviews")).json()) == 1  # no second log


async def test_review_rejects_an_unknown_rating(container: Container, client: httpx.AsyncClient) -> None:
    entry_id = await _seed_entry(container, simplified="土", pinyin="tu3")
    item_id = (await client.post("/study-items", json={"dictionary_entry_id": entry_id})).json()["id"]

    response = await client.post(f"/study-items/{item_id}/reviews", json={"rating": "meh"})

    assert response.status_code == 422
