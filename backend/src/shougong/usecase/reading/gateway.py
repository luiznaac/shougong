"""Outbound ports for the reading-practice slice. Implemented in the adapters."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from shougong.usecase.reading.model import GeneratedReading, ReadingFormat, ReadingRequest, SavedReadingText


@dataclass(frozen=True, slots=True)
class SegmentedToken:
    text: str
    pos_tag: str | None  # raw tagger tag (e.g. "v", "ns"); None for punctuation


class IReadingTextGateway(Protocol):
    """Generates one text — a single shot, never retried."""

    async def generate(
        self,
        *,
        known_words: frozenset[str],
        text_format: ReadingFormat,
        max_extra_words: int,
        topic: str | None,
    ) -> str: ...


class ISegmenter(Protocol):
    def segment(self, text: str) -> tuple[SegmentedToken, ...]: ...


class IReadingHistoryRepository(Protocol):
    async def save(
        self, request: ReadingRequest, reading: GeneratedReading, created_at: datetime
    ) -> SavedReadingText: ...

    async def list(self, *, limit: int, offset: int) -> list[SavedReadingText]:
        """Most recently generated first."""
        ...
