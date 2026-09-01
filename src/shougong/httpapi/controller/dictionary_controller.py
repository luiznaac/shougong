"""`DictionaryController` — read-only access to the CC-CEDICT dictionary.

`GET /dictionary-entries?q=...`  searches by simplified hanzi or pinyin.
`GET /dictionary-entries/{id}`   fetches a single entry.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query

from shougong.httpapi.controller.base import IController
from shougong.httpapi.schema import DictionaryEntryResponse
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
        ) -> list[DictionaryEntryResponse]:
            entries = await self._service.search(q, limit)
            return [DictionaryEntryResponse.from_domain(entry) for entry in entries]

        @router.get("/dictionary-entries/{entry_id}")
        async def get(entry_id: int) -> DictionaryEntryResponse:
            entry = await self._service.get(entry_id)
            return DictionaryEntryResponse.from_domain(entry)

        return router
