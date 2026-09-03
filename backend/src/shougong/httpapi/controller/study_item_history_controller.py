"""`StudyItemHistoryController` — read the trail of a study item's scheduling state.

`GET /study-items/history/learning-to-review`
                                across all items, the history row that moved each one
                                from learning into review, newest first.
`GET /study-items/{id}/history`  one item's history — a row saved when it is created and
                                after every change, each with the time it was written,
                                newest first. 404 if the item is unknown.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query

from shougong.httpapi.controller.base import IController
from shougong.httpapi.schema import StudyItemHistoryResponse
from shougong.usecase.study_item_history.service import StudyItemHistoryService


class StudyItemHistoryController(IController):
    def __init__(self, service: StudyItemHistoryService) -> None:
        self._service = service

    def router(self) -> APIRouter:
        router = APIRouter(tags=["study"], prefix="/study-items")

        @router.get("/history/learning-to-review")
        async def list_learning_to_review(
            limit: Annotated[int, Query(ge=1, le=200)] = 50,
            offset: Annotated[int, Query(ge=0)] = 0,
        ) -> list[StudyItemHistoryResponse]:
            rows = await self._service.learning_to_review_transitions(limit=limit, offset=offset)
            return [StudyItemHistoryResponse.from_domain(row) for row in rows]

        @router.get("/{item_id}/history")
        async def list_history(
            item_id: int,
            limit: Annotated[int, Query(ge=1, le=200)] = 50,
            offset: Annotated[int, Query(ge=0)] = 0,
        ) -> list[StudyItemHistoryResponse]:
            history = await self._service.item_history(item_id, limit=limit, offset=offset)
            return [StudyItemHistoryResponse.from_domain(row) for row in history]

        return router
