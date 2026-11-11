"""`StudyOverviewService` — the dashboard aggregate's counts, local-day bucketing and curve.

Every read is a port call; the clock is fixed, so the day windows and the learned
curve are pinned without a database.
"""

from __future__ import annotations

from datetime import UTC, date, datetime

import pytest

from shougong.usecase.commons.exceptions import InvalidRangeError
from shougong.usecase.commons.time import FixedClock
from shougong.usecase.insights.model import StudyCounts
from shougong.usecase.insights.overview_service import StudyOverviewService
from shougong.usecase.insights.policy import STABILITY_BOUNDS, THRESHOLD, WINDOW_SIZE
from tests.fixtures import FakeInsightRepository

# 2026-03-02T02:00Z is 2026-03-01 21:00 in UTC-5, so the learner's today is still March 1.
_NOW = datetime(2026, 3, 2, 2, tzinfo=UTC)
_WEST = -300


def _service(insights: FakeInsightRepository, *, now: datetime = _NOW) -> StudyOverviewService:
    return StudyOverviewService(insights, FixedClock(now))


async def test_counts_map_onto_the_response_and_review_is_the_due_minus_learning() -> None:
    insights = FakeInsightRepository(
        counts=StudyCounts(total=57, learning=3, due=24, due_learning=3),
        stability=(1, 1, 1, 1, 1),
        due_windows=[0, 0, 0, 0, 0, 0, 0],
    )

    overview = await _service(insights).overview(tz_offset_minutes=0)

    assert overview.new_count == 3
    assert overview.due_count == 24
    assert overview.due_learning_count == 3
    assert overview.due_review_count == 21
    assert overview.item_count == 57


async def test_leech_count_is_one_aggregate_read_with_the_policy_window() -> None:
    insights = FakeInsightRepository(
        counts=StudyCounts(total=3, learning=0, due=0, due_learning=0),
        stability=(3, 0, 0, 0, 0),
        due_windows=[0, 0, 0, 0, 0, 0, 0],
        leeches=2,
    )

    overview = await _service(insights).overview(tz_offset_minutes=0)

    assert overview.leech_count == 2
    assert insights.leech_count_calls == [(WINDOW_SIZE, THRESHOLD)]


async def test_srs_distribution_zips_the_histogram_onto_the_five_stages() -> None:
    insights = FakeInsightRepository(
        counts=StudyCounts(total=23, learning=0, due=0, due_learning=0),
        stability=(6, 15, 2, 0, 0),
        due_windows=[0, 0, 0, 0, 0, 0, 0],
    )

    overview = await _service(insights).overview(tz_offset_minutes=0)

    assert dict(overview.srs_distribution) == {
        "novice": 6,
        "apprentice": 15,
        "journeyman": 2,
        "expert": 0,
        "master": 0,
    }
    assert insights.stability_calls == [STABILITY_BOUNDS]


async def test_forecast_is_seven_local_days_starting_tomorrow() -> None:
    insights = FakeInsightRepository(
        counts=StudyCounts(total=0, learning=0, due=0, due_learning=0),
        stability=(0, 0, 0, 0, 0),
        due_windows=[8, 6, 0, 0, 0, 0, 2],
    )

    overview = await _service(insights).overview(tz_offset_minutes=_WEST)

    assert [row.date for row in overview.next_seven_days] == [
        date(2026, 3, 2),
        date(2026, 3, 3),
        date(2026, 3, 4),
        date(2026, 3, 5),
        date(2026, 3, 6),
        date(2026, 3, 7),
        date(2026, 3, 8),
    ]
    assert [row.due for row in overview.next_seven_days] == [8, 6, 0, 0, 0, 0, 2]
    # tomorrow's local midnight in UTC-5 is 05:00Z; the forecast never covers the past.
    first_start, first_end = insights.due_window_calls[0][0]
    assert first_start == datetime(2026, 3, 2, 5, tzinfo=UTC)
    assert first_end == datetime(2026, 3, 3, 5, tzinfo=UTC)


async def test_learned_is_flat_cumulative_across_local_days() -> None:
    insights = FakeInsightRepository(
        counts=StudyCounts(total=3, learning=0, due=0, due_learning=0),
        stability=(0, 0, 0, 0, 0),
        due_windows=[0, 0, 0, 0, 0, 0, 0],
        transitions=[
            # local 2026-02-27 21:00 in UTC-5
            datetime(2026, 2, 28, 2, tzinfo=UTC),
            # local 2026-03-01 01:00 in UTC-5
            datetime(2026, 3, 1, 6, tzinfo=UTC),
            # local 2026-03-01 20:00 in UTC-5
            datetime(2026, 3, 2, 1, tzinfo=UTC),
        ],
    )

    overview = await _service(insights).overview(tz_offset_minutes=_WEST)

    assert overview.learned.total == 3
    assert [(point.date, point.count) for point in overview.learned.points] == [
        (date(2026, 2, 27), 1),
        (date(2026, 2, 28), 1),
        (date(2026, 3, 1), 3),
    ]


async def test_a_transition_after_the_local_today_is_outside_the_curve_and_its_total() -> None:
    insights = FakeInsightRepository(
        counts=StudyCounts(total=2, learning=0, due=0, due_learning=0),
        stability=(0, 0, 0, 0, 0),
        due_windows=[0, 0, 0, 0, 0, 0, 0],
        transitions=[
            datetime(2026, 2, 28, 2, tzinfo=UTC),  # local Feb 27
            datetime(2026, 3, 3, 12, tzinfo=UTC),  # local Mar 3, after the learner's today
        ],
    )

    overview = await _service(insights).overview(tz_offset_minutes=_WEST)

    assert overview.learned.total == 1
    assert overview.learned.points[-1].count == 1


async def test_learned_with_no_transitions_is_empty() -> None:
    insights = FakeInsightRepository(
        counts=StudyCounts(total=0, learning=0, due=0, due_learning=0),
        stability=(0, 0, 0, 0, 0),
        due_windows=[0, 0, 0, 0, 0, 0, 0],
    )

    overview = await _service(insights).overview(tz_offset_minutes=0)

    assert overview.learned.total == 0
    assert overview.learned.points == ()


@pytest.mark.parametrize("offset", [-841, 841])
async def test_an_out_of_range_offset_is_rejected(offset: int) -> None:
    service = _service(FakeInsightRepository())

    with pytest.raises(InvalidRangeError):
        await service.overview(tz_offset_minutes=offset)


@pytest.mark.parametrize("offset", [-840, 840])
async def test_the_offset_range_edges_are_accepted(offset: int) -> None:
    insights = FakeInsightRepository(
        counts=StudyCounts(total=0, learning=0, due=0, due_learning=0),
        stability=(0, 0, 0, 0, 0),
        due_windows=[0, 0, 0, 0, 0, 0, 0],
    )

    overview = await _service(insights).overview(tz_offset_minutes=offset)

    assert len(overview.next_seven_days) == 7
