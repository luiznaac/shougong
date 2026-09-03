"""Study-item domain model.

A `StudyItem` is a dictionary entry the learner has chosen to practise, together
with its FSRS scheduling state. It holds the joined `DictionaryEntry` rather than
copying its fields.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from shougong.usecase.dictionary.model import DictionaryEntry
from shougong.usecase.srs.model import SrsCard, SrsReviewLog


@dataclass(frozen=True, slots=True)
class StudyItem:
    id: int
    entry: DictionaryEntry
    card: SrsCard
    created_at: datetime


@dataclass(frozen=True, slots=True)
class ReviewResult:
    """The outcome of grading a study item: the rescheduled item and its log entry."""

    item: StudyItem
    log: SrsReviewLog
