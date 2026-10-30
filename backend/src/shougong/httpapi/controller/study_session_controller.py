"""`StudySessionController` — one request's lesson or review selection.

`GET /study/session?kind=lesson|review` returns `{session_id, kind, items}` in the
order the client must present it. The response is authoritative; nothing is persisted.
"""

from __future__ import annotations

from fastapi import APIRouter

from shougong.httpapi.controller.base import IController
from shougong.httpapi.schema import StudySessionResponse
from shougong.usecase.study.model import SessionKind
from shougong.usecase.study.service import StudyService


class StudySessionController(IController):
    def __init__(self, service: StudyService) -> None:
        self._service = service

    def router(self) -> APIRouter:
        router = APIRouter(tags=["study"])

        @router.get("/study/session")
        async def session(kind: SessionKind) -> StudySessionResponse:
            return StudySessionResponse.from_domain(await self._service.session(kind))

        return router
