"""`OverviewController` — the dashboard's server-side aggregate.

`GET /study/overview?tz_offset_minutes=` returns the queue counts, SRS
distribution, seven-day forecast and learned curve in one read. The offset is
minutes east of UTC (the client sends `-new Date().getTimezoneOffset()`); it
affects only day bucketing, never the server's due comparison.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Query

from shougong.httpapi.controller.base import IController
from shougong.httpapi.schema import StudyOverviewResponse
from shougong.usecase.insights.overview_service import MAX_OFFSET_MINUTES, StudyOverviewService


class OverviewController(IController):
    def __init__(self, service: StudyOverviewService) -> None:
        self._service = service

    def router(self) -> APIRouter:
        router = APIRouter(tags=["study"], prefix="/study")

        @router.get("/overview")
        async def overview(
            tz_offset_minutes: Annotated[int, Query(ge=-MAX_OFFSET_MINUTES, le=MAX_OFFSET_MINUTES)] = 0,
        ) -> StudyOverviewResponse:
            result = await self._service.overview(tz_offset_minutes=tz_offset_minutes)
            return StudyOverviewResponse.from_domain(result)

        return router
