"""Outbound port for persisting study items. Implemented in `persistence`."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from typing import Protocol

from shougong.usecase.dictionary.model import DictionaryEntry
from shougong.usecase.srs.model import SrsCard, SrsReviewLog
from shougong.usecase.study.model import StudyItem


class IStudyItemRepository(Protocol):
    """`create` and `update_card` also record a history snapshot for the item
    (see `IStudyItemHistoryRepository`), so the trail can't drift from the live row."""

    async def create(self, entry: DictionaryEntry, card: SrsCard, created_at: datetime) -> StudyItem: ...

    async def get(self, item_id: int) -> StudyItem | None: ...

    async def exists_for_entry(self, entry_id: int) -> bool: ...

    async def update_card(self, item_id: int, card: SrsCard, changed_at: datetime) -> StudyItem: ...

    async def add_review_log(self, item_id: int, log: SrsReviewLog) -> None: ...

    async def list_reviews(self, item_id: int, *, limit: int, offset: int) -> list[SrsReviewLog]: ...

    async def get_many(self, item_ids: Sequence[int]) -> list[StudyItem]:
        """Hydrate a batch of items by id in one read; unknown ids are absent.
        Used by the insights slice so the leech page is not an N+1."""
        ...

    async def list_known_entries(self) -> list[DictionaryEntry]:
        """Every dictionary entry the learner has queued for study, unpaginated —
        regardless of FSRS state. Used to build a "known vocabulary" set."""
        ...

    # NOTE: keep this method last — its name shadows the builtin `list` for any
    # annotation written after it in this class body (mypy resolves the bare
    # `list[...]` forward reference against the class namespace, where `list`
    # is now this method).
    async def list(self, *, due_before: datetime | None, limit: int, offset: int) -> list[StudyItem]: ...
