"""Outbound port for the insight reads. Implemented in `persistence`."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from typing import Protocol

from shougong.usecase.insights.model import DueWindow, GradeWindow, InsightBucket, StudyCounts


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

    async def study_counts(self, *, now: datetime) -> StudyCounts:
        """The queue-wide dashboard counts, computed as one aggregate over the item table."""
        ...

    async def stability_counts(self, *, boundaries: Sequence[float]) -> list[int]:
        """A stability histogram with `len(boundaries) + 1` buckets, ascending.

        Bucket `i` counts items whose stability is at most `boundaries[i]` and greater
        than `boundaries[i - 1]`; a missing stability counts as zero.
        """
        ...

    async def leech_count(self, *, window_size: int, threshold: int) -> int:
        """How many items have at least `threshold` failures in their latest `window_size` grades."""
        ...

    async def due_counts_in_windows(self, windows: Sequence[DueWindow]) -> list[int]:
        """Non-learning items whose `card.due` falls in each `[start, end)` window.

        Returns one count per window, in the same order. Overdue items are never
        counted, because every window is in the future.
        """
        ...

    async def learning_to_review_instants(self) -> list[datetime]:
        """When each learning→review graduation row was written, oldest first.

        No cap: the dashboard's learned curve spans the whole history.
        """
        ...
