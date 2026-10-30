"""Outbound port for the insight reads. Implemented in `persistence`."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from typing import Protocol

from shougong.usecase.insights.model import GradeWindow, InsightBucket


class IInsightRepository(Protocol):
    """Every read here is batched — no method takes a single item id."""

    async def list_grade_windows(self, item_ids: Sequence[int] | None, *, window_size: int) -> list[GradeWindow]:
        """The most recent `window_size` review-log entries for each requested item.

        `item_ids=None` reads every item's window (the queue-wide consumer);
        an empty sequence reads nothing. Grades are ordered review time
        descending, then id descending, and grouped per item.
        """
        ...

    async def recent_mistakes(self, *, start: datetime, end: datetime, limit: int) -> InsightBucket:
        """Items whose current state is review or relearning and that have at least
        one `again` in `[start, end)`, deduped per item, most recent failure first.
        `total` counts every matching item, not just the `limit` returned.
        """
        ...

    async def recently_learned(self, *, start: datetime, end: datetime, limit: int) -> InsightBucket:
        """Items whose learning-to-review transition row landed in `[start, end)`,
        newest transition first. `total` counts every matching transition.
        """
        ...
