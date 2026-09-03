"""`StudyItemHistoryService` — read a study item's history trail."""

from __future__ import annotations

from shougong.usecase.commons.exceptions import ResourceNotFoundError
from shougong.usecase.configuration.transaction import ITransactionTemplate
from shougong.usecase.study.gateway import IStudyItemRepository
from shougong.usecase.study_item_history.gateway import IStudyItemHistoryRepository
from shougong.usecase.study_item_history.model import StudyItemHistory


class StudyItemHistoryService:
    def __init__(
        self,
        history_repository: IStudyItemHistoryRepository,
        study_repository: IStudyItemRepository,
        transaction_template: ITransactionTemplate,
    ) -> None:
        self._history = history_repository
        self._study = study_repository
        self._tx = transaction_template

    async def item_history(self, item_id: int, *, limit: int = 50, offset: int = 0) -> list[StudyItemHistory]:
        """The item's history, newest first — one row per change, starting at creation."""

        async def _run() -> list[StudyItemHistory]:
            if await self._study.get(item_id) is None:
                raise ResourceNotFoundError("study_item", str(item_id))
            return await self._history.list_for_item(item_id, limit=limit, offset=offset)

        return await self._tx.execute(_run)

    async def learning_to_review_transitions(self, *, limit: int = 50, offset: int = 0) -> list[StudyItemHistory]:
        """Across every study item, the history row that moved it from learning into review,
        newest first. One row per item that has graduated; items still learning are absent."""

        return await self._history.list_learning_to_review_transitions(limit=limit, offset=offset)
