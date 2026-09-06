"""`ReadingTopicController` — the editable list of scenarios the reading
generator draws from when the free-text topic is blank.

`GET    /reading-topics`      every scenario, with its active flag.
`POST   /reading-topics`      add a scenario (201).
`PATCH  /reading-topics/{id}` toggle a scenario's active flag.
`DELETE /reading-topics/{id}` remove a scenario (204).
"""

from __future__ import annotations

from fastapi import APIRouter, Response

from shougong.httpapi.controller.base import IController
from shougong.httpapi.schema import AddReadingTopicRequest, ReadingTopicResponse, SetReadingTopicActiveRequest
from shougong.usecase.reading.topic_service import ReadingTopicService


class ReadingTopicController(IController):
    def __init__(self, service: ReadingTopicService) -> None:
        self._service = service

    def router(self) -> APIRouter:
        router = APIRouter(tags=["reading"], prefix="/reading-topics")

        @router.get("")
        async def list_topics() -> list[ReadingTopicResponse]:
            return [ReadingTopicResponse.from_domain(t) for t in await self._service.list()]

        @router.post("", status_code=201)
        async def add(body: AddReadingTopicRequest) -> ReadingTopicResponse:
            return ReadingTopicResponse.from_domain(await self._service.add(body.scenario))

        @router.patch("/{topic_id}")
        async def set_active(topic_id: int, body: SetReadingTopicActiveRequest) -> ReadingTopicResponse:
            return ReadingTopicResponse.from_domain(await self._service.set_active(topic_id, body.active))

        @router.delete("/{topic_id}", status_code=204)
        async def delete(topic_id: int) -> Response:
            await self._service.delete(topic_id)
            return Response(status_code=204)

        return router
