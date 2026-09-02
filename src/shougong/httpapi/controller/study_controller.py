"""`StudyController` — manage the queue of items the learner is studying.

`POST /study-items`              enqueue a dictionary entry (201 + Location).
`GET  /study-items`              list items; `?due=true` filters to what's due now.
`GET  /study-items/{id}`         a single item.
`POST /study-items/{id}/reviews` grade an item and let FSRS reschedule it (201 + Location);
                                409 if the item is not due yet.
`GET  /study-items/{id}/reviews` the item's grade history, newest first.
`GET  /study-items/{id}/history` the item's history — one row per change, newest first,
                                each with the time it was written.
`GET  /study-items/history/learning-to-review`
                                across all items, the history row that moved each one
                                from learning into review, newest first.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query, Response

from shougong.httpapi.controller.base import IController
from shougong.httpapi.schema import (
    AddStudyItemRequest,
    ReviewLogResponse,
    ReviewRequest,
    ReviewResponse,
    StudyItemHistoryResponse,
    StudyItemResponse,
)
from shougong.usecase.study.service import StudyService


class StudyController(IController):
    def __init__(self, service: StudyService) -> None:
        self._service = service

    def router(self) -> APIRouter:
        router = APIRouter(tags=["study"], prefix="/study-items")

        @router.post("", status_code=201)
        async def add(body: AddStudyItemRequest, response: Response) -> StudyItemResponse:
            item = await self._service.add_item(body.dictionary_entry_id)
            response.headers["Location"] = f"/study-items/{item.id}"
            return StudyItemResponse.from_domain(item)

        @router.get("")
        async def list_items(
            due: bool = False,
            limit: Annotated[int, Query(ge=1, le=200)] = 50,
            offset: Annotated[int, Query(ge=0)] = 0,
        ) -> list[StudyItemResponse]:
            items = await self._service.list_items(due_only=due, limit=limit, offset=offset)
            return [StudyItemResponse.from_domain(item) for item in items]

        @router.get("/{item_id}")
        async def get(item_id: int) -> StudyItemResponse:
            return StudyItemResponse.from_domain(await self._service.get_item(item_id))

        @router.post("/{item_id}/reviews", status_code=201)
        async def review(item_id: int, body: ReviewRequest, response: Response) -> ReviewResponse:
            result = await self._service.review_item(item_id, body.to_domain())
            response.headers["Location"] = f"/study-items/{item_id}/reviews"
            return ReviewResponse.from_domain(result)

        @router.get("/{item_id}/reviews")
        async def list_reviews(
            item_id: int,
            limit: Annotated[int, Query(ge=1, le=200)] = 50,
            offset: Annotated[int, Query(ge=0)] = 0,
        ) -> list[ReviewLogResponse]:
            logs = await self._service.item_reviews(item_id, limit=limit, offset=offset)
            return [ReviewLogResponse.from_domain(log) for log in logs]

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
