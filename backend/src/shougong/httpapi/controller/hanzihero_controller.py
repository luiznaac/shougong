"""`HanziHeroController` — connect a HanziHero account and read its status.

`POST /hanzihero/connection`  log in server-side and store only the session cookie.
`GET /hanzihero/connection`   connected flag, connected-at and last-synced-at.
"""

from __future__ import annotations

from fastapi import APIRouter

from shougong.httpapi.controller.base import IController
from shougong.httpapi.schema import HanziHeroConnectRequest, HanziHeroStatusResponse
from shougong.usecase.hanzihero.service import HanziHeroService


class HanziHeroController(IController):
    def __init__(self, service: HanziHeroService) -> None:
        self._service = service

    def router(self) -> APIRouter:
        router = APIRouter(tags=["hanzihero"], prefix="/hanzihero")

        @router.post("/connection")
        async def connect(body: HanziHeroConnectRequest) -> HanziHeroStatusResponse:
            status = await self._service.connect(body.email_username, body.password)
            return HanziHeroStatusResponse.from_domain(status)

        @router.get("/connection")
        async def status() -> HanziHeroStatusResponse:
            return HanziHeroStatusResponse.from_domain(await self._service.status())

        return router
