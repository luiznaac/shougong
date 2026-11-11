"""`GET /study/overview` — the dashboard aggregate against the per-endpoint reads.

The clock is fixed so the forecast and the learned curve are pinned, and the read
model is seeded directly so card states, stabilities and due times are exact.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from datetime import UTC, date, datetime, timedelta

import httpx
import pytest
from sqlalchemy import text

from shougong.application.container import Container
from shougong.application.settings import Settings
from shougong.usecase.commons.time import FixedClock
from shougong.usecase.srs.model import SrsRating, SrsState

_NOW = datetime(2026, 3, 10, 12, tzinfo=UTC)


@pytest.fixture
async def container(settings: Settings) -> AsyncIterator[Container]:
    instance = Container(settings, clock=FixedClock(_NOW))
    try:
        yield instance
    finally:
        await instance.aclose()


def _naive(moment: datetime) -> datetime:
    return moment.astimezone(UTC).replace(tzinfo=None)


async def _seed_item(
    container: Container,
    *,
    simplified: str,
    state: SrsState,
    due: datetime,
    stability: float | None,
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
                " VALUES (:e, :state, :stability, NULL, :due, NULL, :created)"
            ),
            {
                "e": entry_id,
                "state": int(state),
                "stability": stability,
                "due": _naive(due),
                "created": _naive(_NOW),
            },
        )
        return int(item.lastrowid), entry_id


async def _seed_history(container: Container, item_id: int, entry_id: int, state: SrsState, at: datetime) -> None:
    async with container.engine.begin() as conn:
        await conn.execute(
            text(
                "INSERT INTO study_item_history"
                " (study_item_id, created_at, entry_id, card_state, card_stability, card_difficulty,"
                " card_due, card_last_review)"
                " VALUES (:i, :at, :e, :state, NULL, NULL, :due, NULL)"
            ),
            {"i": item_id, "at": _naive(at), "e": entry_id, "state": int(state), "due": _naive(_NOW)},
        )


async def _seed_failures(container: Container, item_id: int, count: int) -> None:
    async with container.engine.begin() as conn:
        await conn.execute(
            text("INSERT INTO review_log (study_item_id, rating, review_datetime) VALUES (:i, :r, :at)"),
            [
                {"i": item_id, "r": int(SrsRating.AGAIN), "at": _naive(_NOW - timedelta(minutes=index + 1))}
                for index in range(count)
            ],
        )


async def _overview(client: httpx.AsyncClient, offset: int | None = None) -> dict[str, object]:
    params = {} if offset is None else {"tz_offset_minutes": offset}
    response = await client.get("/study/overview", params=params)
    assert response.status_code == 200
    return response.json()


async def test_the_aggregate_matches_the_per_endpoint_reads(container: Container, client: httpx.AsyncClient) -> None:
    await _seed_item(container, simplified="学", state=SrsState.LEARNING, due=_NOW - timedelta(hours=1), stability=0.5)
    await _seed_item(container, simplified="习", state=SrsState.LEARNING, due=_NOW + timedelta(days=5), stability=3.0)
    leech, _ = await _seed_item(
        container, simplified="中", state=SrsState.REVIEW, due=_NOW - timedelta(hours=2), stability=10.0
    )
    await _seed_item(
        container, simplified="国", state=SrsState.RELEARNING, due=_NOW - timedelta(minutes=30), stability=50.0
    )
    await _seed_item(
        container,
        simplified="人",
        state=SrsState.REVIEW,
        due=datetime(2026, 3, 11, 5, tzinfo=UTC),
        stability=200.0,
    )
    await _seed_item(
        container,
        simplified="民",
        state=SrsState.REVIEW,
        due=datetime(2026, 3, 13, 12, tzinfo=UTC),
        stability=400.0,
    )
    await _seed_failures(container, leech, 3)

    body = await _overview(client)
    items = (await client.get("/study-items", params={"limit": 200})).json()

    learning = [item for item in items if item["card"]["state"] == "learning"]
    due = [item for item in items if datetime.fromisoformat(item["card"]["due"]) <= _NOW]
    due_learning = [item for item in due if item["card"]["state"] == "learning"]

    assert body["item_count"] == len(items) == 6
    assert body["new_count"] == len(learning) == 2
    assert body["due_count"] == len(due) == 3
    assert body["due_learning_count"] == len(due_learning) == 1
    assert body["due_review_count"] == len(due) - len(due_learning) == 2

    assert body["srs_distribution"] == {
        "novice": 2,
        "apprentice": 1,
        "journeyman": 1,
        "expert": 1,
        "master": 1,
    }

    leeches = (await client.get("/study-items", params={"leech": "true", "limit": 200})).json()
    assert body["leech_count"] == len(leeches) == 1

    assert [row["date"] for row in body["next_seven_days"]] == [
        "2026-03-11",
        "2026-03-12",
        "2026-03-13",
        "2026-03-14",
        "2026-03-15",
        "2026-03-16",
        "2026-03-17",
    ]
    assert [row["due"] for row in body["next_seven_days"]] == [1, 0, 1, 0, 0, 0, 0]
    # no graduation yet
    assert body["learned"] == {"total": 0, "points": []}


async def test_the_learned_curve_matches_the_transition_endpoint(
    container: Container, client: httpx.AsyncClient
) -> None:
    first, first_entry = await _seed_item(container, simplified="甲", state=SrsState.REVIEW, due=_NOW, stability=10.0)
    second, second_entry = await _seed_item(container, simplified="乙", state=SrsState.REVIEW, due=_NOW, stability=10.0)
    for item, entry, learned_at in (
        (first, first_entry, datetime(2026, 3, 8, 3, tzinfo=UTC)),
        (second, second_entry, datetime(2026, 3, 9, 3, tzinfo=UTC)),
    ):
        await _seed_history(container, item, entry, SrsState.LEARNING, learned_at - timedelta(hours=2))
        await _seed_history(container, item, entry, SrsState.REVIEW, learned_at)

    body = await _overview(client)
    transitions = (await client.get("/study-items/history/learning-to-review")).json()

    assert body["learned"]["total"] == len(transitions) == 2
    assert body["learned"]["points"] == [
        {"date": "2026-03-08", "count": 1},
        {"date": "2026-03-09", "count": 2},
        {"date": "2026-03-10", "count": 2},
    ]


async def test_a_negative_offset_shifts_the_forecast_day_buckets(
    container: Container, client: httpx.AsyncClient
) -> None:
    await _seed_item(
        container,
        simplified="龙",
        state=SrsState.REVIEW,
        due=datetime(2026, 3, 11, 5, tzinfo=UTC),
        stability=10.0,
    )

    utc = await _overview(client, offset=0)
    west = await _overview(client, offset=-600)  # UTC-10: the card falls on the local 10th

    assert utc["next_seven_days"][0] == {"date": "2026-03-11", "due": 1}
    assert west["next_seven_days"][0] == {"date": "2026-03-11", "due": 0}


async def test_the_forecast_starts_tomorrow_and_excludes_learning_items(
    container: Container, client: httpx.AsyncClient
) -> None:
    await _seed_item(
        container,
        simplified="虎",
        state=SrsState.LEARNING,
        due=datetime(2026, 3, 11, 5, tzinfo=UTC),
        stability=None,
    )
    await _seed_item(
        container,
        simplified="蛇",
        state=SrsState.REVIEW,
        due=_NOW - timedelta(days=2),
        stability=10.0,
    )

    body = await _overview(client, offset=0)

    assert body["next_seven_days"][0]["date"] == (date(2026, 3, 11)).isoformat()
    assert all(row["due"] == 0 for row in body["next_seven_days"])
    assert body["due_review_count"] == 1  # the overdue card is not in the forecast


async def test_the_stability_boundaries_collapse_into_five_groups(
    container: Container, client: httpx.AsyncClient
) -> None:
    for index, stability in enumerate((1, 4, 7, 14, 30, 60, 120, 240, 365, 366)):
        await _seed_item(
            container,
            simplified=f"字{index}",
            state=SrsState.REVIEW,
            due=_NOW,
            stability=float(stability),
        )

    body = await _overview(client)

    assert body["srs_distribution"] == {
        "novice": 2,  # 1, 4
        "apprentice": 2,  # 7, 14
        "journeyman": 2,  # 30, 60
        "expert": 3,  # 120, 240, 365
        "master": 1,  # 366
    }


async def test_the_default_offset_is_zero(container: Container, client: httpx.AsyncClient) -> None:
    assert await _overview(client) == await _overview(client, offset=0)


@pytest.mark.parametrize("offset", [-841, 841])
async def test_an_out_of_range_offset_is_422(container: Container, client: httpx.AsyncClient, offset: int) -> None:
    response = await client.get("/study/overview", params={"tz_offset_minutes": offset})

    assert response.status_code == 422
