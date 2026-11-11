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
from shougong.usecase.srs.model import SrsCard, SrsReviewLog, SrsState


@dataclass(frozen=True, slots=True)
class StudyItem:
    id: int
    entry: DictionaryEntry
    card: SrsCard
    created_at: datetime
    # Opaque display-ordering key; `None` when the item is not pinned. Never render raw.
    priority_position: int | None = None


class PriorityEdge(StrEnum):
    FRONT = "front"
    BACK = "back"


class StudyItemSort(StrEnum):
    """The orderings a filtered study-item list accepts.

    A leech list with no explicit sort keeps its own worst-first order; `None`
    therefore means "not given", distinct from the default `due_asc`.
    """

    DUE_ASC = "due_asc"
    CREATED_DESC = "created_desc"
    STABILITY_ASC = "stability_asc"


@dataclass(frozen=True, slots=True)
class StudyItemFilters:
    """The optional filters on a study-item list read; values within a field OR,
    different fields AND.

    `due` is the shorthand for `due_to = now`; the service resolves it against the
    clock before the adapter sees the filters, so an adapter only honours the
    instant bounds. `hsk_levels` holds `None` for the `none` (outside HSK) bucket.
    """

    due: bool = False
    leech: bool = False
    states: tuple[SrsState, ...] = ()
    hsk_levels: tuple[int | None, ...] = ()
    pos_tags: tuple[str, ...] = ()
    search: str | None = None
    due_from: datetime | None = None
    due_to: datetime | None = None
    sort: StudyItemSort | None = None


class SessionKind(StrEnum):
    LESSON = "lesson"
    REVIEW = "review"


@dataclass(frozen=True, slots=True)
class StudySession:
    """One request's card selection, in the order the client must present it.

    `session_id` is opaque and informational only — never an ordering input or a
    resume key; every request produces a fresh shuffle.
    """

    session_id: str
    kind: SessionKind
    items: tuple[StudyItem, ...]


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
    # populated when `detail` is an ambiguous-match error: the entries the
    # caller can choose between to resolve the row (e.g. via `POST /study-items`)
    candidates: tuple[DictionaryEntry, ...] = ()


@dataclass(frozen=True, slots=True)
class BatchImportReport:
    outcomes: tuple[BatchImportOutcome, ...]
