"""Insights domain model — the grade window and the Extra Study buckets.

The leech flag is never stored: a read projects the recent review log into a
`GradeWindow`, and the policy in `policy.py` decides chronic failure from it.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from datetime import date, datetime
from enum import StrEnum

from shougong.usecase.srs.model import SrsRating
from shougong.usecase.study.model import StudyItem

# One `[start, end)` instant window, e.g. one local calendar day in UTC.
type DueWindow = tuple[datetime, datetime]


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


class SrsStage(StrEnum):
    """The five display groups a card's stability falls into, ascending."""

    NOVICE = "novice"
    APPRENTICE = "apprentice"
    JOURNEYMAN = "journeyman"
    EXPERT = "expert"
    MASTER = "master"


@dataclass(frozen=True, slots=True)
class StudyCounts:
    """The dashboard's queue counts, read in one aggregate.

    `due_learning` is a subset of `due`; the review-side due count is `due - due_learning`.
    """

    total: int
    learning: int
    due: int
    due_learning: int


@dataclass(frozen=True, slots=True)
class DailyDue:
    """One forecast row: a local calendar date and how many non-learning cards fall on it."""

    date: date
    due: int


@dataclass(frozen=True, slots=True)
class LearnedPoint:
    """One day of the cumulative learning→review curve."""

    date: date
    count: int


@dataclass(frozen=True, slots=True)
class LearnedProgress:
    """Every graduation counted cumulatively, one point per local day."""

    total: int
    points: tuple[LearnedPoint, ...]


@dataclass(frozen=True, slots=True)
class StudyOverview:
    """The dashboard aggregate: queue counts, SRS distribution, forecast and learned curve."""

    new_count: int
    due_count: int
    due_review_count: int
    due_learning_count: int
    item_count: int
    leech_count: int
    srs_distribution: Mapping[SrsStage, int]
    next_seven_days: tuple[DailyDue, ...]
    learned: LearnedProgress
