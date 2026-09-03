"""Outbound port for the study item's history trail. Implemented in `persistence`."""

from __future__ import annotations

from datetime import datetime
from typing import Protocol

from shougong.usecase.study.model import StudyItem
from shougong.usecase.study_item_history.model import StudyItemHistory


class IStudyItemHistoryRepository(Protocol):
    """`record` appends a snapshot of a study item's state — `StudyItemRepository`
    calls it on creation and after every change, so the trail can't drift from the
    live row. The `list_*` methods read it back."""

    async def record(self, item: StudyItem, recorded_at: datetime) -> None: ...

    async def list_for_item(self, item_id: int, *, limit: int, offset: int) -> list[StudyItemHistory]: ...

    # Across every study item, the one history row that moved it from LEARNING to REVIEW
    # state (its previous history row was LEARNING, this one is REVIEW).
    async def list_learning_to_review_transitions(self, *, limit: int, offset: int) -> list[StudyItemHistory]: ...
