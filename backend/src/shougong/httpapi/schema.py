"""Transport DTOs. Pydantic lives here, at the edge — never in `usecase`."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from shougong.usecase.dictionary.model import DictionaryEntry
from shougong.usecase.health.checker import HealthCheckResult
from shougong.usecase.srs.model import SrsCard, SrsRating, SrsReviewLog
from shougong.usecase.study.model import BatchImportOutcome, BatchImportReport, ReviewResult, StudyItem
from shougong.usecase.study_item_history.model import StudyItemHistory


class HealthCheckResponse(BaseModel):
    service_name: str
    is_healthy: bool
    timestamp: datetime

    @classmethod
    def from_domain(cls, result: HealthCheckResult) -> HealthCheckResponse:
        return cls(
            service_name=result.service_name,
            is_healthy=result.is_healthy,
            timestamp=result.timestamp,
        )


class DictionaryEntryResponse(BaseModel):
    id: int
    simplified: str
    pinyin: str
    definitions: list[str]

    @classmethod
    def from_domain(cls, entry: DictionaryEntry) -> DictionaryEntryResponse:
        return cls(
            id=entry.id,
            simplified=entry.simplified,
            pinyin=entry.pinyin,
            definitions=list(entry.definitions),
        )


class SrsCardResponse(BaseModel):
    state: str
    due: datetime
    stability: float | None
    difficulty: float | None
    last_review: datetime | None

    @classmethod
    def from_domain(cls, card: SrsCard) -> SrsCardResponse:
        return cls(
            state=card.state.name.lower(),
            due=card.due,
            stability=card.stability,
            difficulty=card.difficulty,
            last_review=card.last_review,
        )


class StudyItemResponse(BaseModel):
    id: int
    entry: DictionaryEntryResponse
    card: SrsCardResponse
    created_at: datetime

    @classmethod
    def from_domain(cls, item: StudyItem) -> StudyItemResponse:
        return cls(
            id=item.id,
            entry=DictionaryEntryResponse.from_domain(item.entry),
            card=SrsCardResponse.from_domain(item.card),
            created_at=item.created_at,
        )


class AddStudyItemRequest(BaseModel):
    dictionary_entry_id: int


class BatchImportRowRequest(BaseModel):
    hanzi: str
    pinyin: str = ""


class BatchImportRequest(BaseModel):
    rows: list[BatchImportRowRequest] = Field(min_length=1, max_length=1000)


class BatchImportOutcomeResponse(BaseModel):
    row: int
    hanzi: str
    pinyin: str
    status: str  # "created" | "skipped" | "error"
    study_item_id: int | None
    detail: str | None
    # populated when `status` is "error" and more than one dictionary entry matched:
    # pick one and POST it to /study-items to resolve the row.
    candidates: list[DictionaryEntryResponse] = Field(default_factory=list)

    @classmethod
    def from_domain(cls, outcome: BatchImportOutcome) -> BatchImportOutcomeResponse:
        return cls(
            row=outcome.row,
            hanzi=outcome.hanzi,
            pinyin=outcome.pinyin,
            status=outcome.status.value,
            study_item_id=outcome.study_item_id,
            detail=outcome.detail,
            candidates=[DictionaryEntryResponse.from_domain(entry) for entry in outcome.candidates],
        )


class BatchImportResponse(BaseModel):
    created: int
    skipped: int
    errors: int
    outcomes: list[BatchImportOutcomeResponse]

    @classmethod
    def from_domain(cls, report: BatchImportReport) -> BatchImportResponse:
        outcomes = [BatchImportOutcomeResponse.from_domain(o) for o in report.outcomes]
        return cls(
            created=sum(1 for o in outcomes if o.status == "created"),
            skipped=sum(1 for o in outcomes if o.status == "skipped"),
            errors=sum(1 for o in outcomes if o.status == "error"),
            outcomes=outcomes,
        )


class ReviewRequest(BaseModel):
    rating: Literal["again", "hard", "good", "easy"]

    def to_domain(self) -> SrsRating:
        return SrsRating[self.rating.upper()]


class ReviewLogResponse(BaseModel):
    rating: str
    review_datetime: datetime

    @classmethod
    def from_domain(cls, log: SrsReviewLog) -> ReviewLogResponse:
        return cls(rating=log.rating.name.lower(), review_datetime=log.review_datetime)


class StudyItemHistoryResponse(BaseModel):
    study_item_id: int
    entry: DictionaryEntryResponse
    card: SrsCardResponse
    created_at: datetime

    @classmethod
    def from_domain(cls, history: StudyItemHistory) -> StudyItemHistoryResponse:
        return cls(
            study_item_id=history.study_item_id,
            entry=DictionaryEntryResponse.from_domain(history.entry),
            card=SrsCardResponse.from_domain(history.card),
            created_at=history.created_at,
        )


class ReviewResponse(BaseModel):
    item: StudyItemResponse
    review: ReviewLogResponse

    @classmethod
    def from_domain(cls, result: ReviewResult) -> ReviewResponse:
        return cls(
            item=StudyItemResponse.from_domain(result.item),
            review=ReviewLogResponse.from_domain(result.log),
        )
