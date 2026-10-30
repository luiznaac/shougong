"""Insight HTTP contract: leech flags on the study surfaces and the Extra Study buckets.

The read models are seeded directly so the tests can pin review times and card states
without fighting the SRS clock; the app's own grade path is still exercised for the
review response's `is_leech: false`.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta

import httpx
from sqlalchemy import text

from shougong.application.container import Container
from shougong.usecase.srs.model import SrsRating, SrsState

_AT = datetime(2026, 3, 1, 12, tzinfo=UTC)


def _naive(moment: datetime) -> datetime:
    return moment.astimezone(UTC).replace(tzinfo=None)


async def _seed_item(
    container: Container,
    *,
    simplified: str,
    state: SrsState = SrsState.LEARNING,
    due: datetime = _AT,
) -> tuple[int, int]:
    async with container.engine.begin() as conn:
        entry = await conn.execute(
            text("INSERT INTO dictionary_entry (simplified, pinyin, definitions) VALUES (:s, 'xue2', :d)"),
            {"s": simplified, "d": json.dumps(["to learn"])},
        )
        entry_id = int(entry.lastrowid)
        item = await conn.execute(
            text(
                "INSERT INTO study_item"
                " (entry_id, card_state, card_stability, card_difficulty, card_due, card_last_review, created_at)"
                " VALUES (:e, :state, NULL, NULL, :due, NULL, :created)"
            ),
            {"e": entry_id, "state": int(state), "due": _naive(due), "created": _naive(_AT)},
        )
        item_id = int(item.lastrowid)
        # production writes a creation snapshot too (StudyItemRepository.create)
        await conn.execute(
            text(
                "INSERT INTO study_item_history"
                " (study_item_id, created_at, entry_id, card_state, card_stability, card_difficulty,"
                " card_due, card_last_review)"
                " VALUES (:i, :at, :e, :state, NULL, NULL, :due, NULL)"
            ),
            {"i": item_id, "at": _naive(_AT), "e": entry_id, "state": int(state), "due": _naive(due)},
        )
        return item_id, entry_id


async def _seed_review(container: Container, item_id: int, rating: SrsRating, at: datetime) -> None:
    async with container.engine.begin() as conn:
        await conn.execute(
            text("INSERT INTO review_log (study_item_id, rating, review_datetime) VALUES (:i, :r, :at)"),
            {"i": item_id, "r": int(rating), "at": _naive(at)},
        )


async def _seed_history(container: Container, item_id: int, entry_id: int, state: SrsState, at: datetime) -> None:
    async with container.engine.begin() as conn:
        await conn.execute(
            text(
                "INSERT INTO study_item_history"
                " (study_item_id, created_at, entry_id, card_state, card_stability, card_difficulty,"
                " card_due, card_last_review)"
                " VALUES (:i, :at, :e, :state, NULL, NULL, :due, NULL)"
            ),
            {"i": item_id, "at": _naive(at), "e": entry_id, "state": int(state), "due": _naive(_AT)},
        )


async def _seed_failures(container: Container, item_id: int, count: int, *, ending_at: datetime) -> None:
    for index in range(count):
        await _seed_review(
            container,
            item_id,
            SrsRating.AGAIN,
            ending_at - timedelta(minutes=count - index),
        )


async def _range(client: httpx.AsyncClient, *, start: datetime, end: datetime) -> httpx.Response:
    return await client.get(
        "/study/insights/extra-study",
        params={"from": start.isoformat(), "to": end.isoformat()},
    )


async def test_the_leech_flag_is_annotated_on_the_list_and_detail(
    container: Container, client: httpx.AsyncClient
) -> None:
    leech, _ = await _seed_item(container, simplified="龙")
    ordinary, _ = await _seed_item(container, simplified="虎")
    await _seed_failures(container, leech, 3, ending_at=_AT)

    listed = {row["id"]: row for row in (await client.get("/study-items")).json()}
    assert listed[leech]["is_leech"] is True
    assert listed[ordinary]["is_leech"] is False

    detail = (await client.get(f"/study-items/{leech}")).json()
    assert detail["is_leech"] is True


async def test_review_and_history_responses_leave_the_flag_false(
    container: Container, client: httpx.AsyncClient
) -> None:
    leech, _ = await _seed_item(container, simplified="蛇", due=_AT - timedelta(days=1))
    await _seed_failures(container, leech, 3, ending_at=_AT - timedelta(days=2))

    reviewed = await client.post(f"/study-items/{leech}/reviews", json={"rating": "good"})
    assert reviewed.status_code == 201
    assert reviewed.json()["item"]["is_leech"] is False

    history = (await client.get(f"/study-items/{leech}/history")).json()
    assert [row["is_leech"] for row in history] == [False, False]


async def test_the_leech_filter_orders_worst_first_and_paginates(
    container: Container, client: httpx.AsyncClient
) -> None:
    three, _ = await _seed_item(container, simplified="一")
    four, _ = await _seed_item(container, simplified="二")
    five, _ = await _seed_item(container, simplified="三")
    await _seed_item(container, simplified="四")  # no history -> not a leech
    await _seed_failures(container, three, 3, ending_at=_AT - timedelta(days=1))
    await _seed_failures(container, four, 4, ending_at=_AT - timedelta(days=2))
    await _seed_failures(container, five, 5, ending_at=_AT - timedelta(days=3))

    first = await client.get("/study-items", params={"leech": "true", "limit": 2, "offset": 0})
    second = await client.get("/study-items", params={"leech": "true", "limit": 2, "offset": 2})

    assert [row["id"] for row in first.json()] == [five, four]
    assert [row["id"] for row in second.json()] == [three]
    assert all(row["is_leech"] is True for row in first.json() + second.json())

    # the default list keeps its due-then-id ordering
    default = await client.get("/study-items")
    assert [row["id"] for row in default.json()] == sorted(row["id"] for row in default.json())


async def test_extra_study_buckets_are_seeded_deduped_and_ordered(
    container: Container, client: httpx.AsyncClient
) -> None:
    two_failures, two_entry = await _seed_item(container, simplified="甲", state=SrsState.REVIEW)
    three_failures, _ = await _seed_item(container, simplified="乙", state=SrsState.RELEARNING)
    learning, _ = await _seed_item(container, simplified="丙", state=SrsState.LEARNING)
    old_failure, _ = await _seed_item(container, simplified="丁", state=SrsState.REVIEW)

    await _seed_failures(container, two_failures, 2, ending_at=_AT - timedelta(days=1))
    await _seed_failures(container, three_failures, 3, ending_at=_AT - timedelta(hours=3))
    await _seed_review(container, learning, SrsRating.AGAIN, _AT - timedelta(hours=2))
    await _seed_review(container, old_failure, SrsRating.AGAIN, _AT - timedelta(days=10))

    older_transition, older_entry = await _seed_item(container, simplified="戊", state=SrsState.REVIEW)
    newer_transition, newer_entry = await _seed_item(container, simplified="己", state=SrsState.REVIEW)
    out_of_window, out_entry = await _seed_item(container, simplified="庚", state=SrsState.REVIEW)
    for item, entry, learn_at, review_at in (
        (older_transition, older_entry, _AT - timedelta(days=5), _AT - timedelta(days=2)),
        (newer_transition, newer_entry, _AT - timedelta(days=4), _AT - timedelta(days=1)),
        (out_of_window, out_entry, _AT - timedelta(days=12), _AT - timedelta(days=10)),
    ):
        await _seed_history(container, item, entry, SrsState.LEARNING, learn_at)
        await _seed_history(container, item, entry, SrsState.REVIEW, review_at)

    body = (await _range(client, start=_AT - timedelta(days=3), end=_AT + timedelta(days=1))).json()

    mistakes = body["recent_mistakes"]
    assert mistakes["total"] == 2  # the learning-state and out-of-window failures are excluded
    assert [item["id"] for item in mistakes["items"]] == [three_failures, two_failures]
    assert mistakes["items"][1]["id"] == two_failures  # listed once despite two in-range failures
    assert mistakes["items"][1]["entry"]["id"] == two_entry
    assert [item["is_leech"] for item in mistakes["items"]] == [True, False]

    learned = body["recently_learned"]
    assert learned["total"] == 2  # the out-of-window transition is excluded
    assert [item["id"] for item in learned["items"]] == [newer_transition, older_transition]


async def test_extra_study_reports_a_true_total_and_caps_a_bucket_at_200(
    container: Container, client: httpx.AsyncClient
) -> None:
    count = 201
    async with container.engine.begin() as conn:
        await conn.execute(
            text("INSERT INTO dictionary_entry (simplified, pinyin, definitions) VALUES (:s, 'xue2', :d)"),
            [{"s": f"字{index}", "d": json.dumps(["word"])} for index in range(count)],
        )
        entry_ids = [int(row) for row in (await conn.execute(text("SELECT id FROM dictionary_entry"))).scalars()]
        await conn.execute(
            text(
                "INSERT INTO study_item"
                " (entry_id, card_state, card_stability, card_difficulty, card_due, card_last_review, created_at)"
                " VALUES (:e, :state, NULL, NULL, :due, NULL, :created)"
            ),
            [
                {"e": entry_id, "state": int(SrsState.REVIEW), "due": _naive(_AT), "created": _naive(_AT)}
                for entry_id in entry_ids
            ],
        )
        item_ids = [int(row) for row in (await conn.execute(text("SELECT id FROM study_item"))).scalars()]
        await conn.execute(
            text("INSERT INTO review_log (study_item_id, rating, review_datetime) VALUES (:i, :r, :at)"),
            [
                {"i": item_id, "r": int(SrsRating.AGAIN), "at": _naive(_AT - timedelta(minutes=index))}
                for index, item_id in enumerate(item_ids)
            ],
        )

    body = (await _range(client, start=_AT - timedelta(days=3), end=_AT + timedelta(days=1))).json()

    assert body["recent_mistakes"]["total"] == count
    assert len(body["recent_mistakes"]["items"]) == 200
    assert body["recently_learned"] == {"total": 0, "items": []}


async def test_extra_study_empty_window_is_two_empty_buckets(container: Container, client: httpx.AsyncClient) -> None:
    body = (await _range(client, start=_AT - timedelta(days=3), end=_AT)).json()

    assert body["recent_mistakes"] == {"total": 0, "items": []}
    assert body["recently_learned"] == {"total": 0, "items": []}


async def test_extra_study_echoes_the_instant_range(container: Container, client: httpx.AsyncClient) -> None:
    start = _AT - timedelta(days=3)
    end = _AT

    body = (await _range(client, start=start, end=end)).json()

    assert datetime.fromisoformat(body["from"]) == start
    assert datetime.fromisoformat(body["to"]) == end


async def test_extra_study_rejects_missing_inverted_and_over_long_ranges(
    container: Container, client: httpx.AsyncClient
) -> None:
    missing = await client.get("/study/insights/extra-study")
    half_missing = await client.get("/study/insights/extra-study", params={"from": _AT.isoformat()})
    inverted = await _range(client, start=_AT, end=_AT)
    too_long = await _range(client, start=_AT - timedelta(days=32, seconds=1), end=_AT)

    assert missing.status_code == 422
    assert half_missing.status_code == 422
    assert inverted.status_code == 422
    assert too_long.status_code == 422


async def test_extra_study_accepts_exactly_32_days(container: Container, client: httpx.AsyncClient) -> None:
    response = await _range(client, start=_AT - timedelta(days=32), end=_AT)

    assert response.status_code == 200
