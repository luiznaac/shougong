"""`VocabularyController` — a read-only grammatical overview of the learner's
known words (HSK level + word classes), shown in the "Meu vocabulário" panel.

`GET /reading-vocabulary`  every known word's level + categories, plus a summary.
"""

from __future__ import annotations

from fastapi import APIRouter

from shougong.httpapi.controller.base import IController
from shougong.httpapi.schema import (
    VocabularyOverviewResponse,
    VocabularySummaryResponse,
    VocabularyWordResponse,
)
from shougong.usecase.reading.vocabulary_service import VocabularyOverviewService


class VocabularyController(IController):
    def __init__(self, service: VocabularyOverviewService) -> None:
        self._service = service

    def router(self) -> APIRouter:
        router = APIRouter(tags=["reading"], prefix="/reading-vocabulary")

        @router.get("")
        async def overview() -> VocabularyOverviewResponse:
            words = await self._service.list()
            summary = await self._service.summary()
            return VocabularyOverviewResponse(
                profiles=[VocabularyWordResponse.from_domain(w) for w in words],
                summary=VocabularySummaryResponse.from_domain(summary),
            )

        return router
