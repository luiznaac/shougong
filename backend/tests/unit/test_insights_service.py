"""`InsightService` — leech flags from one batched read and the Extra Study buckets."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from shougong.usecase.commons.exceptions import InvalidRangeError
from shougong.usecase.insights.model import GradeWindow, InsightBucket, ReviewGrade
from shougong.usecase.insights.service import InsightService
from shougong.usecase.srs.model import SrsRating
from tests.fixtures import (
    FakeInsightRepository,
    FakeStudyItemRepository,
    FakeTransactionTemplate,
    make_study_item,
)

_NOW = datetime(2026, 2, 10, 12, tzinfo=UTC)


def _window(item_id: int, ratings: list[SrsRating]) -> GradeWindow:
    grades = tuple(
        ReviewGrade(rating=rating, review_datetime=_NOW - timedelta(minutes=index))
        for index, rating in enumerate(ratings)
    )
    return GradeWindow(study_item_id=item_id, grades=grades)


def _service(
    *,
    insights: FakeInsightRepository | None = None,
    study: FakeStudyItemRepository | None = None,
) -> InsightService:
    return InsightService(
        insights or FakeInsightRepository(),
        study or FakeStudyItemRepository(),
        FakeTransactionTemplate(),
    )


async def test_leech_flags_reads_every_window_in_one_batch() -> None:
    windows = [
        _window(1, [SrsRating.AGAIN] * 3),
        _window(2, [SrsRating.AGAIN, SrsRating.GOOD]),
    ]
    insights = FakeInsightRepository(windows)
    service = _service(insights=insights)

    flags = await service.leech_flags([1, 2, 3])

    assert flags == {1: True, 2: False, 3: False}
    assert len(insights.window_calls) == 1
    assert insights.window_calls[0][0] == (1, 2, 3)


async def test_leech_flags_of_an_empty_page_skips_the_read() -> None:
    insights = FakeInsightRepository()
    service = _service(insights=insights)

    flags = await service.leech_flags([])

    assert flags == {}
    assert insights.window_calls == []


async def test_leech_items_returns_the_worst_first_page() -> None:
    study = FakeStudyItemRepository([make_study_item(item_id=i) for i in range(1, 4)])
    insights = FakeInsightRepository(
        [
            _window(1, [SrsRating.AGAIN] * 3),
            _window(2, [SrsRating.AGAIN] * 4),
            _window(3, [SrsRating.GOOD]),
        ]
    )
    service = _service(insights=insights, study=study)

    items, flags = await service.leech_items(limit=1, offset=0)

    assert [item.id for item in items] == [2]
    assert flags == {2: True}
    assert insights.window_calls == [(None, 10)]  # queue-wide: no id filter


async def test_extra_study_returns_both_buckets_and_their_leech_flags() -> None:
    mistakes = InsightBucket(total=2, items=(make_study_item(item_id=1),))
    learned = InsightBucket(total=1, items=(make_study_item(item_id=2),))
    insights = FakeInsightRepository(
        windows=[_window(1, [SrsRating.AGAIN] * 3), _window(2, [SrsRating.GOOD])],
        mistakes=mistakes,
        learned=learned,
    )
    service = _service(insights=insights)

    report = await service.extra_study(start=_NOW - timedelta(days=3), end=_NOW)

    assert report.recent_mistakes == mistakes
    assert report.recently_learned == learned
    assert report.leech_flags == {1: True, 2: False}
    assert len(insights.window_calls) == 1  # one batched window read for both buckets


async def test_extra_study_rejects_an_inverted_range() -> None:
    service = _service()

    with pytest.raises(InvalidRangeError):
        await service.extra_study(start=_NOW, end=_NOW)


async def test_extra_study_rejects_a_range_longer_than_32_days() -> None:
    service = _service()

    with pytest.raises(InvalidRangeError):
        await service.extra_study(start=_NOW, end=_NOW + timedelta(days=32, seconds=1))


async def test_extra_study_accepts_exactly_32_days() -> None:
    service = _service()

    report = await service.extra_study(start=_NOW, end=_NOW + timedelta(days=32))

    assert report.start == _NOW
