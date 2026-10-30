"""`InsightsController` — read the learner's recent failures and graduations.

`GET /study/insights/extra-study?from=&to=` returns both buckets for the instant
range (`from` inclusive, `to` exclusive), with a true total and at most 200 items
per bucket.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Query

from shougong.httpapi.controller.base import IController
from shougong.httpapi.schema import ExtraStudyResponse
from shougong.usecase.insights.service import InsightService


class InsightsController(IController):
    def __init__(self, service: InsightService) -> None:
        self._service = service

    def router(self) -> APIRouter:
        router = APIRouter(tags=["study"], prefix="/study/insights")

        @router.get("/extra-study")
        async def extra_study(
            from_: Annotated[datetime, Query(alias="from")],
            to: Annotated[datetime, Query(alias="to")],
        ) -> ExtraStudyResponse:
            report = await self._service.extra_study(start=from_, end=to)
            return ExtraStudyResponse.from_domain(report)

        return router
