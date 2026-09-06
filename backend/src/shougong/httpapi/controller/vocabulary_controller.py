"""`VocabularyController` — the grammatical profile of the learner's known words,
used to build a balanced working set for reading generation.

`GET   /reading-vocabulary`              every known word's level + category, plus a summary.
`POST  /reading-vocabulary/sync`         (re)resolve profiles from the HSK dataset; returns the summary.
`PATCH /reading-vocabulary/{simplified}` override one word's category/level by hand.
"""

from __future__ import annotations

from fastapi import APIRouter

from shougong.httpapi.controller.base import IController
from shougong.httpapi.schema import (
    OverrideVocabularyRequest,
    VocabularyOverviewResponse,
    VocabularyProfileResponse,
    VocabularySummaryResponse,
)
from shougong.usecase.reading.vocabulary_service import VocabularyProfileService


class VocabularyController(IController):
    def __init__(self, service: VocabularyProfileService) -> None:
        self._service = service

    def router(self) -> APIRouter:
        router = APIRouter(tags=["reading"], prefix="/reading-vocabulary")

        @router.get("")
        async def overview() -> VocabularyOverviewResponse:
            profiles = await self._service.list()
            summary = await self._service.summary()
            return VocabularyOverviewResponse(
                profiles=[VocabularyProfileResponse.from_domain(p) for p in profiles],
                summary=VocabularySummaryResponse.from_domain(summary),
            )

        @router.post("/sync")
        async def sync() -> VocabularySummaryResponse:
            return VocabularySummaryResponse.from_domain(await self._service.sync())

        @router.patch("/{simplified}")
        async def override(simplified: str, body: OverrideVocabularyRequest) -> VocabularyProfileResponse:
            profile = await self._service.override(simplified, body.category(), body.hsk_level)
            return VocabularyProfileResponse.from_domain(profile)

        return router
