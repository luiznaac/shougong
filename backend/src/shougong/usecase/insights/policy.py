"""The insight rules, in one place: chronic failure (leeches) and the Extra Study range.

These are product rules, so the constants are code — never environment configuration.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime

from shougong.usecase.insights.model import GradeWindow
from shougong.usecase.srs.model import SrsRating

# A leech is three or more `again` grades among the item's ten most recent entries.
WINDOW_SIZE = 10
THRESHOLD = 3

# Extra Study accepts at most a 32-day instant range and returns at most 200 items per bucket.
MAX_RANGE_DAYS = 32
ITEM_CAP = 200


@dataclass(frozen=True, slots=True)
class LeechRank:
    """One leech's worst-first ordering key."""

    study_item_id: int
    failure_count: int
    latest_failure: datetime


def failure_count(window: GradeWindow) -> int:
    """How many `again` grades the (newest-first, at most `WINDOW_SIZE` long) window holds."""
    return sum(1 for grade in window.grades if grade.rating == SrsRating.AGAIN)


def is_leech(window: GradeWindow) -> bool:
    """Whether the item's recent history meets the chronic-failure threshold.

    The flag is derived on every read, so a good streak that pushes failures out
    of the window clears it with no stored state to reset.
    """
    return failure_count(window) >= THRESHOLD


def order_leeches(windows: Sequence[GradeWindow]) -> list[LeechRank]:
    """The leech windows as a worst-first list: failure count, then most recent
    failure, both descending, then item id ascending.
    """
    ranked = [
        LeechRank(
            study_item_id=window.study_item_id,
            failure_count=failure_count(window),
            latest_failure=next(grade.review_datetime for grade in window.grades if grade.rating == SrsRating.AGAIN),
        )
        for window in windows
        if is_leech(window)
    ]
    ranked.sort(key=lambda rank: rank.study_item_id)
    ranked.sort(key=lambda rank: (rank.failure_count, rank.latest_failure), reverse=True)
    return ranked
