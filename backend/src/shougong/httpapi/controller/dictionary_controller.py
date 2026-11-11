"""`DictionaryController` — read-only access to the CC-CEDICT dictionary.

`GET /dictionary-entries?q=&limit=&offset=`  one page of matches (envelope), ordered
                                             shortest-first.
`GET /dictionary-entries/{id}`               fetches a single entry.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query

from shougong.httpapi.controller.base import IController
from shougong.httpapi.schema import (
    DictionaryEntryResponse,
    PageResponse,
    RelatedEntriesResponse,
    RelatedEntryResponse,
    page_response,
)
from shougong.usecase.dictionary.service import DictionaryService

_MAX_LIMIT = 100


class DictionaryController(IController):
    def __init__(self, service: DictionaryService) -> None:
        self._service = service

    def router(self) -> APIRouter:
        router = APIRouter(tags=["dictionary"])

        @router.get("/dictionary-entries")
        async def search(
            q: Annotated[str, Query(min_length=1)],
            limit: Annotated[int, Query(ge=1, le=_MAX_LIMIT)] = 20,
            offset: Annotated[int, Query(ge=0)] = 0,
        ) -> PageResponse[DictionaryEntryResponse]:
            page = await self._service.search(q, limit=limit, offset=offset)
            return page_response(page, DictionaryEntryResponse.from_domain)

        @router.get("/dictionary-entries/{entry_id}")
        async def get(entry_id: int) -> DictionaryEntryResponse:
            entry = await self._service.get(entry_id)
            return DictionaryEntryResponse.from_domain(entry)

        @router.get("/dictionary-entries/{entry_id}/related")
        async def related(
            entry_id: int,
            limit: Annotated[int, Query(ge=1, le=_MAX_LIMIT)] = 20,
            offset: Annotated[int, Query(ge=0)] = 0,
        ) -> RelatedEntriesResponse:
            rows, total = await self._service.related(entry_id, limit=limit, offset=offset)
            return RelatedEntriesResponse(
                items=[RelatedEntryResponse.from_related(row) for row in rows],
                total=total,
                limit=limit,
                offset=offset,
            )

        return router
