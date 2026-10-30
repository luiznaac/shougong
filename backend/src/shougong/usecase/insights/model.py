"""Insights domain model — the grade window and the Extra Study buckets.

The leech flag is never stored: a read projects the recent review log into a
`GradeWindow`, and the policy in `policy.py` decides chronic failure from it.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import datetime

from shougong.usecase.srs.model import SrsRating
from shougong.usecase.study.model import StudyItem


@dataclass(frozen=True, slots=True)
class ReviewGrade:
    """One review-log row inside an item's grade window."""

    rating: SrsRating
    review_datetime: datetime


@dataclass(frozen=True, slots=True)
class GradeWindow:
    """An item's most recent review-log entries, newest first.

    The repository caps the tuple at the policy window size; an item with a
    shorter history is returned as-is.
    """

    study_item_id: int
    grades: tuple[ReviewGrade, ...]


@dataclass(frozen=True, slots=True)
class InsightBucket:
    """One Extra Study tab: a true total plus its capped, ordered items."""

    total: int
    items: tuple[StudyItem, ...]


@dataclass(frozen=True, slots=True)
class ExtraStudyReport:
    """Both Extra Study buckets for one instant range (`start` inclusive, `end` exclusive),
    plus the leech flag for every item that appears in them."""

    start: datetime
    end: datetime
    recent_mistakes: InsightBucket
    recently_learned: InsightBucket
    leech_flags: Mapping[int, bool]
