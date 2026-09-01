"""`StudyController` — manage the queue of items the learner is studying.

`POST /study-items`        enqueue a dictionary entry (201 + Location).
`GET  /study-items`        list items; `?due=true` filters to what's due now.
`GET  /study-items/{id}`   a single item.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query, Response

from shougong.httpapi.schema import AddStudyItemRequest, StudyItemResponse
from shougong.usecase.study.service import StudyService


class StudyController:
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

        return router
