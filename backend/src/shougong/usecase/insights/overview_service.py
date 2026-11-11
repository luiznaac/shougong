"""`StudyOverviewService` — compose the dashboard aggregate in the learner's local calendar.

All day bucketing happens here, from the client's UTC offset, so the persistence
port only answers instant and count questions. Reads stay aggregate: no full-row
hydration and no pagination.
"""

from __future__ import annotations

from collections import Counter
from collections.abc import Sequence
from datetime import UTC, date, datetime, time, timedelta, timezone

from shougong.usecase.commons.exceptions import InvalidRangeError
from shougong.usecase.commons.time import IClock
from shougong.usecase.insights.gateway import IInsightRepository
from shougong.usecase.insights.model import (
    DailyDue,
    DueWindow,
    LearnedPoint,
    LearnedProgress,
    SrsStage,
    StudyOverview,
)
from shougong.usecase.insights.policy import STABILITY_BOUNDS, THRESHOLD, WINDOW_SIZE

# The client sends `-new Date().getTimezoneOffset()`; UTC-14..UTC+14 is the real span.
MAX_OFFSET_MINUTES = 840
_FORECAST_DAYS = 7


def _validate_offset(tz_offset_minutes: int) -> None:
    if not -MAX_OFFSET_MINUTES <= tz_offset_minutes <= MAX_OFFSET_MINUTES:
        raise InvalidRangeError(f"tz_offset_minutes must be between -{MAX_OFFSET_MINUTES} and {MAX_OFFSET_MINUTES}")


def _local_midnight(local_date: date, tz: timezone) -> datetime:
    """Local midnight of `local_date` as the UTC instant the database stores."""
    return datetime.combine(local_date, time.min, tzinfo=tz).astimezone(UTC)


def _forecast_windows(today: date, tz: timezone) -> list[DueWindow]:
    return [
        (
            _local_midnight(today + timedelta(days=day), tz),
            _local_midnight(today + timedelta(days=day + 1), tz),
        )
        for day in range(1, _FORECAST_DAYS + 1)
    ]


def _learned_curve(transitions: Sequence[datetime], now: datetime, tz: timezone) -> LearnedProgress:
    today = now.astimezone(tz).date()
    days = [instant.astimezone(tz).date() for instant in transitions]
    # The curve stops at the learner's today, so `total` is exactly the last point.
    days = [day for day in days if day <= today]
    if not days:
        return LearnedProgress(total=0, points=())

    counts = Counter(days)
    points: list[LearnedPoint] = []
    running = 0
    current = min(counts)
    while current <= today:
        running += counts.get(current, 0)
        points.append(LearnedPoint(date=current, count=running))
        current += timedelta(days=1)
    return LearnedProgress(total=len(days), points=tuple(points))


class StudyOverviewService:
    def __init__(self, insight_repository: IInsightRepository, clock: IClock) -> None:
        self._insights = insight_repository
        self._clock = clock

    async def overview(self, *, tz_offset_minutes: int = 0) -> StudyOverview:
        """The dashboard aggregate for the learner's local calendar.

        `tz_offset_minutes` is minutes east of UTC (the client sends
        `-new Date().getTimezoneOffset()`); it affects only day bucketing — due
        counts compare against the server's now.
        """
        _validate_offset(tz_offset_minutes)
        now = self._clock.now()
        tz = timezone(timedelta(minutes=tz_offset_minutes))
        today = now.astimezone(tz).date()

        counts = await self._insights.study_counts(now=now)
        histogram = await self._insights.stability_counts(boundaries=STABILITY_BOUNDS)
        forecast = await self._insights.due_counts_in_windows(_forecast_windows(today, tz))
        transitions = await self._insights.learning_to_review_instants()
        leech_count = await self._insights.leech_count(window_size=WINDOW_SIZE, threshold=THRESHOLD)

        return StudyOverview(
            new_count=counts.learning,
            due_count=counts.due,
            due_review_count=counts.due - counts.due_learning,
            due_learning_count=counts.due_learning,
            item_count=counts.total,
            leech_count=leech_count,
            srs_distribution=dict(zip(SrsStage, histogram, strict=True)),
            next_seven_days=tuple(
                DailyDue(date=today + timedelta(days=offset), due=due) for offset, due in enumerate(forecast, start=1)
            ),
            learned=_learned_curve(transitions, now, tz),
        )
