"""Transport DTOs. Pydantic lives here, at the edge — never in `usecase`."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from shougong.usecase.dictionary.model import DictionaryEntry
from shougong.usecase.health.checker import HealthCheckResult
from shougong.usecase.srs.model import SrsCard, SrsRating, SrsReviewLog
from shougong.usecase.study.model import ReviewResult, StudyItem
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
