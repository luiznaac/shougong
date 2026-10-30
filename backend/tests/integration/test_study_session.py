from __future__ import annotations

import json
from datetime import datetime

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


async def _add_item(client: httpx.AsyncClient, container: Container, *, simplified: str, pinyin: str) -> int:
    entry_id = await _seed_entry(container, simplified=simplified, pinyin=pinyin)
    created = await client.post("/study-items", json={"dictionary_entry_id": entry_id})
    assert created.status_code == 201
    return int(created.json()["id"])


async def _set_card(container: Container, item_id: int, *, state: int, due: datetime) -> None:
    async with container.engine.begin() as conn:
        await conn.execute(
            text("UPDATE study_item SET card_state = :state, card_due = :due WHERE id = :id"),
            {"state": state, "due": due, "id": item_id},
        )


async def _priority_count(container: Container, item_id: int) -> int:
    async with container.engine.connect() as conn:
        count = await conn.scalar(
            text("SELECT COUNT(*) FROM study_item_priority WHERE study_item_id = :id"),
            {"id": item_id},
        )
        return int(count or 0)


async def test_pin_move_and_unpin_survive_a_reload(container: Container, client: httpx.AsyncClient) -> None:
    first = await _add_item(client, container, simplified="学", pinyin="xue2")
    second = await _add_item(client, container, simplified="水", pinyin="shui3")
    third = await _add_item(client, container, simplified="火", pinyin="huo3")

    assert (await client.post(f"/study-items/{first}/priority", json={"position": "front"})).json()[
        "priority_position"
    ] == 0
    assert (await client.post(f"/study-items/{second}/priority", json={"position": "back"})).json()[
        "priority_position"
    ] == 1
    assert (await client.post(f"/study-items/{third}/priority", json={"position": "front"})).json()[
        "priority_position"
    ] == -1
    # moving an already-pinned item to the other edge goes past that edge
    moved = await client.post(f"/study-items/{first}/priority", json={"position": "back"})
    assert moved.status_code == 200
    assert moved.json()["priority_position"] == 2

    reloaded = {row["id"]: row for row in (await client.get("/study-items")).json()}
    assert reloaded[third]["priority_position"] == -1
    assert reloaded[second]["priority_position"] == 1
    assert reloaded[first]["priority_position"] == 2
    assert (await client.get(f"/study-items/{first}")).json()["priority_position"] == 2

    unpinned = await client.delete(f"/study-items/{second}/priority")
    assert unpinned.status_code == 204
    assert (await client.get(f"/study-items/{second}")).json()["priority_position"] is None
    assert (await client.delete(f"/study-items/{second}/priority")).status_code == 204  # idempotent


async def test_priority_unknown_item_is_404_and_non_learning_is_409(
    container: Container, client: httpx.AsyncClient
) -> None:
    assert (await client.post("/study-items/999999/priority", json={"position": "front"})).status_code == 404
    assert (await client.delete("/study-items/999999/priority")).status_code == 404

    item_id = await _add_item(client, container, simplified="木", pinyin="mu4")
    assert (await client.post(f"/study-items/{item_id}/reviews", json={"rating": "good"})).status_code == 201

    conflicting = await client.post(f"/study-items/{item_id}/priority", json={"position": "back"})
    assert conflicting.status_code == 409


async def test_learning_to_review_graduation_deletes_the_priority_row(
    container: Container, client: httpx.AsyncClient
) -> None:
    item_id = await _add_item(client, container, simplified="土", pinyin="tu3")
    assert (await client.post(f"/study-items/{item_id}/priority", json={"position": "front"})).status_code == 200
    assert await _priority_count(container, item_id) == 1

    reviewed = await client.post(f"/study-items/{item_id}/reviews", json={"rating": "good"})

    assert reviewed.status_code == 201
    assert reviewed.json()["item"]["priority_position"] is None
    assert await _priority_count(container, item_id) == 0
    # the graduated item is no longer part of the lesson selection
    lesson = (await client.get("/study/session", params={"kind": "lesson"})).json()
    assert item_id not in {row["id"] for row in lesson["items"]}


async def test_duplicate_positions_order_by_position_then_id(container: Container, client: httpx.AsyncClient) -> None:
    first = await _add_item(client, container, simplified="日", pinyin="ri4")
    second = await _add_item(client, container, simplified="月", pinyin="yue4")
    third = await _add_item(client, container, simplified="水", pinyin="shui3")
    async with container.engine.begin() as conn:
        await conn.execute(
            text("INSERT INTO study_item_priority (study_item_id, position) VALUES (:a, 7), (:b, 7)"),
            {"a": first, "b": second},
        )

    session = (await client.get("/study/session", params={"kind": "lesson"})).json()

    # both duplicates are pinned: position 7, then the id tiebreak; the unpinned
    # remainder (shuffled every request) follows.
    assert [row["id"] for row in session["items"][:2]] == [first, second]
    assert {row["id"] for row in session["items"][2:]} == {third}


async def test_review_session_takes_only_due_non_learning_items(
    container: Container, client: httpx.AsyncClient
) -> None:
    past = datetime(2020, 1, 1)
    future = datetime(2035, 1, 1)
    learning = await _add_item(client, container, simplified="人", pinyin="ren2")
    review_due = await _add_item(client, container, simplified="口", pinyin="kou3")
    relearning_due = await _add_item(client, container, simplified="手", pinyin="shou3")
    review_future = await _add_item(client, container, simplified="足", pinyin="zu2")
    await _set_card(container, review_due, state=2, due=past)
    await _set_card(container, relearning_due, state=3, due=past)
    await _set_card(container, review_future, state=2, due=future)

    session = (await client.get("/study/session", params={"kind": "review"})).json()

    assert session["kind"] == "review"
    assert {row["id"] for row in session["items"]} == {review_due, relearning_due}
    assert learning not in {row["id"] for row in session["items"]}
    assert review_future not in {row["id"] for row in session["items"]}


async def test_empty_session_and_kind_validation(container: Container, client: httpx.AsyncClient) -> None:
    first = await client.get("/study/session", params={"kind": "lesson"})
    second = await client.get("/study/session", params={"kind": "lesson"})

    assert first.status_code == 200
    assert first.json()["items"] == []
    assert first.json()["session_id"]
    assert first.json()["session_id"] != second.json()["session_id"]

    assert (await client.get("/study/session")).status_code == 422
    assert (await client.get("/study/session", params={"kind": "quiz"})).status_code == 422
