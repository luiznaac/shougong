"""`ReadingController` — generate vocabulary-restricted reading texts.

`POST /reading-texts` generate a new text, persist it, return it.
`GET  /reading-texts`  list previously generated texts, newest first.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query

from shougong.httpapi.controller.base import IController
from shougong.httpapi.schema import GenerateReadingRequest, SavedReadingTextResponse
from shougong.usecase.reading.service import ReadingService


class ReadingController(IController):
    def __init__(self, service: ReadingService) -> None:
        self._service = service

    def router(self) -> APIRouter:
        router = APIRouter(tags=["reading"], prefix="/reading-texts")

        @router.post("", status_code=201)
        async def generate(body: GenerateReadingRequest) -> SavedReadingTextResponse:
            saved = await self._service.generate(body.to_domain())
            return SavedReadingTextResponse.from_domain(saved)

        @router.get("")
        async def list_history(
            limit: Annotated[int, Query(ge=1, le=200)] = 20,
            offset: Annotated[int, Query(ge=0)] = 0,
        ) -> list[SavedReadingTextResponse]:
            items = await self._service.list_history(limit=limit, offset=offset)
            return [SavedReadingTextResponse.from_domain(item) for item in items]

        return router
