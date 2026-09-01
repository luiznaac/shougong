"""SRS domain model — a first-party mirror of the FSRS card/rating shapes.

The `fsrs` library never reaches this far in: the adapter in `shougong.srs`
converts between these types and `fsrs`'s own.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import IntEnum


class SrsRating(IntEnum):
    AGAIN = 1
    HARD = 2
    GOOD = 3
    EASY = 4


class SrsState(IntEnum):
    LEARNING = 1
    REVIEW = 2
    RELEARNING = 3


@dataclass(frozen=True, slots=True)
class SrsCard:
    state: SrsState
    step: int | None
    stability: float | None
    difficulty: float | None
    due: datetime
    last_review: datetime | None


@dataclass(frozen=True, slots=True)
class SrsReviewLog:
    rating: SrsRating
    review_datetime: datetime
