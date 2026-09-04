"""`StrokesController` — read-only access to per-character stroke order data.

`GET /characters/{character}/strokes`  fetches one character's stroke paths.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Path

from shougong.httpapi.controller.base import IController
from shougong.httpapi.schema import CharacterStrokesResponse
from shougong.usecase.strokes.service import StrokeService


class StrokesController(IController):
    def __init__(self, service: StrokeService) -> None:
        self._service = service

    def router(self) -> APIRouter:
        router = APIRouter(tags=["strokes"])

        @router.get("/characters/{character}/strokes")
        async def get(character: Annotated[str, Path(min_length=1, max_length=1)]) -> CharacterStrokesResponse:
            strokes = await self._service.get(character)
            return CharacterStrokesResponse.from_domain(strokes)

        return router
