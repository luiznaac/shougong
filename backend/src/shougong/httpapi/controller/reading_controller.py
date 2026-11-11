"""`ReadingController` — generate vocabulary-restricted reading texts.

`POST /reading-texts`        generate a new text, persist it, return it.
`GET  /reading-texts`        summary list (newest first), optionally filtered by `entry_id`.
`GET  /reading-texts/{id}`   one full reading (deep link / selected article).
`GET  /reading-texts/models` model ids the backing AI proxy currently exposes.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query

from shougong.httpapi.controller.base import IController
from shougong.httpapi.schema import (
    GenerateReadingRequest,
    ReadingSummaryPageResponse,
    SavedReadingTextResponse,
)
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
            entry_id: int | None = None,
            limit: Annotated[int, Query(ge=1, le=100)] = 20,
            offset: Annotated[int, Query(ge=0)] = 0,
        ) -> ReadingSummaryPageResponse:
            page = await self._service.list_summaries(limit=limit, offset=offset, entry_id=entry_id)
            return ReadingSummaryPageResponse.from_domain(page)

        @router.get("/models")
        async def list_models() -> list[str]:
            return list(await self._service.list_models())

        @router.get("/{reading_id}")
        async def get_reading(reading_id: int) -> SavedReadingTextResponse:
            return SavedReadingTextResponse.from_domain(await self._service.get(reading_id))

        return router
