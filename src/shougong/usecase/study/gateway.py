"""Outbound port for persisting study items. Implemented in `persistence`."""

from __future__ import annotations

from datetime import datetime
from typing import Protocol

from shougong.usecase.dictionary.model import DictionaryEntry
from shougong.usecase.srs.model import SrsCard, SrsReviewLog
from shougong.usecase.study.model import StudyItem, StudyItemHistory


class IStudyItemRepository(Protocol):
    """`create` and `update_card` also append a `StudyItemHistory` row for the item,
    so `list_history` returns its stored state after every change, starting with
    its creation."""

    async def create(self, entry: DictionaryEntry, card: SrsCard, created_at: datetime) -> StudyItem: ...

    async def get(self, item_id: int) -> StudyItem | None: ...

    async def exists_for_entry(self, entry_id: int) -> bool: ...

    async def update_card(self, item_id: int, card: SrsCard, changed_at: datetime) -> StudyItem: ...

    async def add_review_log(self, item_id: int, log: SrsReviewLog) -> None: ...

    async def list_reviews(self, item_id: int, *, limit: int, offset: int) -> list[SrsReviewLog]: ...

    async def list_history(self, item_id: int, *, limit: int, offset: int) -> list[StudyItemHistory]: ...

    # Across every study item, the one history row that moved it from LEARNING to REVIEW
    # state (its previous history row was LEARNING, this one is REVIEW).
    async def list_learning_to_review_transitions(self, *, limit: int, offset: int) -> list[StudyItemHistory]: ...

    async def list(self, *, due_before: datetime | None, limit: int, offset: int) -> list[StudyItem]: ...
