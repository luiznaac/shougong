"""HTTP contract for the study-item list: envelope, filters, sorts and validation.

Seeded directly so a test can pin HSK level, POS tags, stability and due instants;
the list read is the only surface under test here.
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


async def _seed(
    container: Container,
    *,
    simplified: str,
    pinyin: str = "xue2",
    hsk_level: int | None = None,
    pos_tags: tuple[str, ...] = (),
    state: SrsState = SrsState.LEARNING,
    due: datetime = _AT,
    stability: float | None = None,
    created_at: datetime = _AT,
) -> tuple[int, int]:
    async with container.engine.begin() as conn:
        entry = await conn.execute(
            text(
                "INSERT INTO dictionary_entry (simplified, pinyin, definitions, hsk_level, pos_tags)"
                " VALUES (:s, :p, :d, :hsk, :tags)"
            ),
            {
                "s": simplified,
                "p": pinyin,
                "d": json.dumps(["to learn"]),
                "hsk": hsk_level,
                "tags": json.dumps(list(pos_tags)),
            },
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
                "created": _naive(created_at),
            },
        )
        return int(item.lastrowid), entry_id


async def _seed_failures(container: Container, item_id: int, count: int, *, ending_at: datetime) -> None:
    async with container.engine.begin() as conn:
        await conn.execute(
            text("INSERT INTO review_log (study_item_id, rating, review_datetime) VALUES (:i, :r, :at)"),
            [
                {
                    "i": item_id,
                    "r": int(SrsRating.AGAIN),
                    "at": _naive(ending_at - timedelta(minutes=count - index)),
                }
                for index in range(count)
            ],
        )


async def test_list_returns_an_envelope_with_an_exact_stable_total(
    container: Container, client: httpx.AsyncClient
) -> None:
    await _seed(container, simplified="一")
    await _seed(container, simplified="二")
    await _seed(container, simplified="三")

    first = (await client.get("/study-items", params={"limit": 2, "offset": 0})).json()
    second = (await client.get("/study-items", params={"limit": 2, "offset": 2})).json()
    empty = (await client.get("/study-items", params={"search": "没有这个词"})).json()

    assert first["total"] == 3
    assert (first["limit"], first["offset"]) == (2, 0)
    assert len(first["items"]) == 2
    assert second["total"] == 3
    assert len(second["items"]) == 1
    assert empty == {"items": [], "total": 0, "limit": 20, "offset": 0}


async def test_hsk_level_filter_accepts_levels_none_and_repeats(
    container: Container, client: httpx.AsyncClient
) -> None:
    levelled, _ = await _seed(container, simplified="学", hsk_level=1)
    outside, _ = await _seed(container, simplified="习", hsk_level=None)

    by_level = (await client.get("/study-items", params={"hsk_level": "1"})).json()
    by_none = (await client.get("/study-items", params={"hsk_level": "none"})).json()
    both = (await client.get("/study-items", params=[("hsk_level", "1"), ("hsk_level", "none")])).json()

    assert [row["id"] for row in by_level["items"]] == [levelled]
    assert [row["id"] for row in by_none["items"]] == [outside]
    assert {row["id"] for row in both["items"]} == {levelled, outside}
    assert both["total"] == 2


async def test_pos_tag_filter_matches_any_shared_tag(container: Container, client: httpx.AsyncClient) -> None:
    verb, _ = await _seed(container, simplified="学", pos_tags=("v", "n"))
    adjective, _ = await _seed(container, simplified="好", pos_tags=("a",))

    by_tag = (await client.get("/study-items", params={"pos_tag": "v"})).json()
    by_many = (await client.get("/study-items", params=[("pos_tag", "n"), ("pos_tag", "a")])).json()

    assert [row["id"] for row in by_tag["items"]] == [verb]
    assert {row["id"] for row in by_many["items"]} == {verb, adjective}


async def test_search_matches_pinyin_case_insensitively(container: Container, client: httpx.AsyncClient) -> None:
    studied, _ = await _seed(container, simplified="学习", pinyin="xue2 xi2")
    await _seed(container, simplified="水", pinyin="shui3")

    body = (await client.get("/study-items", params={"search": "XUE2"})).json()

    assert [row["id"] for row in body["items"]] == [studied]
    assert body["total"] == 1


async def test_state_and_search_filters_combine_with_and(container: Container, client: httpx.AsyncClient) -> None:
    learning, _ = await _seed(container, simplified="学习", state=SrsState.LEARNING)
    reviewed, _ = await _seed(container, simplified="学", state=SrsState.REVIEW)

    body = (await client.get("/study-items", params={"state": "review", "search": "学"})).json()

    assert [row["id"] for row in body["items"]] == [reviewed]
    assert reviewed != learning


async def test_stability_asc_puts_null_stability_last(container: Container, client: httpx.AsyncClient) -> None:
    stable, _ = await _seed(container, simplified="一", state=SrsState.REVIEW, stability=2.0)
    unstable, _ = await _seed(container, simplified="二", state=SrsState.REVIEW, stability=None)

    body = (await client.get("/study-items", params={"sort": "stability_asc"})).json()

    assert [row["id"] for row in body["items"]] == [stable, unstable]


async def test_created_desc_orders_newest_first(container: Container, client: httpx.AsyncClient) -> None:
    older, _ = await _seed(container, simplified="一", created_at=_AT - timedelta(days=2))
    newer, _ = await _seed(container, simplified="二", created_at=_AT)

    body = (await client.get("/study-items", params={"sort": "created_desc"})).json()

    assert [row["id"] for row in body["items"]] == [newer, older]


async def test_leech_filter_orders_worst_first_and_an_explicit_sort_overrides_it(
    container: Container, client: httpx.AsyncClient
) -> None:
    three, _ = await _seed(container, simplified="一")
    five, _ = await _seed(container, simplified="二")
    await _seed_failures(container, three, 3, ending_at=_AT - timedelta(days=1))
    await _seed_failures(container, five, 5, ending_at=_AT - timedelta(days=2))

    worst_first = (await client.get("/study-items", params={"leech": "true"})).json()
    everything = (await client.get("/study-items", params={"limit": 100})).json()
    by_due = (await client.get("/study-items", params={"leech": "true", "sort": "due_asc"})).json()

    assert [row["id"] for row in worst_first["items"]] == [five, three]
    assert worst_first["total"] == 2
    assert all(row["is_leech"] is True for row in worst_first["items"])
    assert {row["id"] for row in by_due["items"]} == {three, five}
    # the SQL filter and the derived is_leech flag must agree on the same seed
    assert {row["id"] for row in everything["items"] if row["is_leech"]} == {row["id"] for row in worst_first["items"]}


async def test_invalid_filters_are_422(container: Container, client: httpx.AsyncClient) -> None:
    inverted = await client.get(
        "/study-items",
        params={"due_from": _AT.isoformat(), "due_to": _AT.isoformat()},
    )
    bad_state = await client.get("/study-items", params={"state": "graduated"})
    bad_hsk = await client.get("/study-items", params={"hsk_level": "10"})
    bad_sort = await client.get("/study-items", params={"sort": "alphabetical"})
    bad_limit = await client.get("/study-items", params={"limit": 101})
    blank_search = await client.get("/study-items", params={"search": "   "})
    naive_instant = await client.get("/study-items", params={"due_from": "2026-03-01T12:00:00"})

    assert inverted.status_code == 422
    assert bad_state.status_code == 422
    assert bad_hsk.status_code == 422
    assert bad_sort.status_code == 422
    assert bad_limit.status_code == 422
    assert blank_search.status_code == 422
    assert naive_instant.status_code == 422
