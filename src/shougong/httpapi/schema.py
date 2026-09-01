"""Transport DTOs. Pydantic lives here, at the edge — never in `usecase`."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from shougong.usecase.dictionary.model import DictionaryEntry
from shougong.usecase.health.checker import HealthCheckResult
from shougong.usecase.srs.model import SrsCard
from shougong.usecase.study.model import StudyItem


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
