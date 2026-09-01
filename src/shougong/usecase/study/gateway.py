"""Outbound port for persisting study items. Implemented in `persistence`."""

from __future__ import annotations

from datetime import datetime
from typing import Protocol

from shougong.usecase.dictionary.model import DictionaryEntry
from shougong.usecase.srs.model import SrsCard
from shougong.usecase.study.model import StudyItem


class IStudyItemRepository(Protocol):
    async def create(self, entry: DictionaryEntry, card: SrsCard, created_at: datetime) -> StudyItem: ...

    async def get(self, item_id: int) -> StudyItem | None: ...

    async def exists_for_entry(self, entry_id: int) -> bool: ...

    async def list(self, *, due_before: datetime | None, limit: int, offset: int) -> list[StudyItem]: ...
