"""Outbound ports for the reading-practice slice. Implemented in the adapters."""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from shougong.usecase.reading.model import (
    GeneratedReading,
    PartOfSpeech,
    ReadingFormat,
    ReadingRequest,
    SavedReadingText,
)
from shougong.usecase.reading.vocabulary import HskEntry, VocabularyProfile
from shougong.usecase.reading.working_set import WordUsage, WorkingSet


@dataclass(frozen=True, slots=True)
class SegmentedToken:
    text: str
    # Already translated to this app's own PartOfSpeech by the segmenter
    # implementation — this port never carries a raw tagger-specific tag.
    part_of_speech: PartOfSpeech | None


@dataclass(frozen=True, slots=True)
class RejectedDraft:
    """A prior draft the service rejected, fed back so the model can revise it."""

    draft: str
    rejected_words: tuple[str, ...]  # words in the draft that are outside known_words


@dataclass(frozen=True, slots=True)
class ReadingDraft:
    text: str
    prompt_tokens: int
    completion_tokens: int


class IReadingTextGateway(Protocol):
    """Produces one draft per call. The service may call it again with the
    previous drafts in ``prior_attempts`` to have the model revise its work."""

    async def list_models(self) -> tuple[str, ...]:
        """Model ids the backing proxy currently exposes, sorted."""
        ...

    async def generate(
        self,
        *,
        working_set: WorkingSet,
        text_format: ReadingFormat,
        max_extra_words: int,
        model: str,
        topic: str | None,
        prior_attempts: Sequence[RejectedDraft] = (),
    ) -> ReadingDraft: ...


class ISegmenter(Protocol):
    def segment(self, text: str) -> tuple[SegmentedToken, ...]: ...


class IReadingHistoryRepository(Protocol):
    async def save(
        self, request: ReadingRequest, reading: GeneratedReading, created_at: datetime
    ) -> SavedReadingText: ...

    async def list(self, *, limit: int, offset: int) -> list[SavedReadingText]:
        """Most recently generated first."""
        ...


class IHskVocabularySource(Protocol):
    """The HSK 3.0 word list from its upstream (a community dataset)."""

    async def fetch(self) -> dict[str, HskEntry]:
        """Every listed word → its level and POS tags. Cached after the first call."""
        ...


class IVocabularyProfileRepository(Protocol):
    async def list_all(self) -> list[VocabularyProfile]: ...

    async def upsert_many(self, profiles: Sequence[VocabularyProfile], updated_at: datetime) -> None: ...

    async def get(self, simplified: str) -> VocabularyProfile | None: ...


class IReadingWordUsageRepository(Protocol):
    """How often, and how recently, each word has appeared in a generated
    reading — feeds the working-set recency bias."""

    async def load(self, words: Sequence[str]) -> dict[str, WordUsage]: ...

    async def record(self, words: Sequence[str], at: datetime) -> None:
        """Bump the use count and set last_used_at for each word."""
        ...
