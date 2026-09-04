"""Study-item domain model.

A `StudyItem` is a dictionary entry the learner has chosen to practise, together
with its FSRS scheduling state. It holds the joined `DictionaryEntry` rather than
copying its fields.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum

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


class BatchRowStatus(StrEnum):
    CREATED = "created"
    SKIPPED = "skipped"
    ERROR = "error"


@dataclass(frozen=True, slots=True)
class BatchImportRow:
    """One CSV line: a hanzi + numbered-tone pinyin pair to enqueue."""

    hanzi: str
    pinyin: str


@dataclass(frozen=True, slots=True)
class BatchImportOutcome:
    """What happened to one row of a batch import."""

    row: int  # 1-based position in the submitted list
    hanzi: str
    pinyin: str
    status: BatchRowStatus
    study_item_id: int | None = None
    detail: str | None = None  # reason a row was skipped or errored


@dataclass(frozen=True, slots=True)
class BatchImportReport:
    outcomes: tuple[BatchImportOutcome, ...]
