"""`StudyController` — manage the queue of items the learner is studying.

`POST /study-items`              enqueue a dictionary entry (201 + Location).
`POST /study-items/batch`        enqueue many from CSV rows (hanzi + pinyin); returns a per-row report.
`GET  /study-items`              one page of the filtered, ordered queue (envelope);
                                 `?leech=true` filters to leeches, worst-first unless
                                 `sort` is given.
`GET  /study-items/{id}`         a single item.
`POST /study-items/{id}/reviews` grade an item and let FSRS reschedule it (201 + Location);
                                 409 if the item is not due yet.
`GET  /study-items/{id}/reviews` the item's grade history, newest first.
`POST /study-items/{id}/priority` pin a learning item to the front/back of the lesson
                                 queue (upsert; 409 for a non-learning item).
`DELETE /study-items/{id}/priority` unpin an item (204, idempotent).

The item's history trail lives in `StudyItemHistoryController`; the lesson/review
selection lives in `StudySessionController`.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Query, Response
from pydantic import AfterValidator

from shougong.httpapi.controller.base import IController
from shougong.httpapi.schema import (
    AddStudyItemRequest,
    BatchImportRequest,
    BatchImportResponse,
    PageResponse,
    PriorityRequest,
    ReviewLogResponse,
    ReviewRequest,
    ReviewResponse,
    StudyItemResponse,
    page_response,
)
from shougong.usecase.insights.service import InsightService
from shougong.usecase.srs.model import SrsState
from shougong.usecase.study.model import BatchImportRow, StudyItemFilters, StudyItemSort
from shougong.usecase.study.service import StudyService

type HskLevelParam = Literal["1", "2", "3", "4", "5", "6", "7", "8", "9", "none"]
type StateParam = Literal["learning", "review", "relearning"]


def _trimmed_search(value: str) -> str:
    """Reject a whitespace-only search and hand the service the trimmed needle."""
    trimmed = value.strip()
    if not trimmed:
        raise ValueError("search must not be blank")
    return trimmed


def _aware_instant(value: datetime) -> datetime:
    """The range bounds are instants: a naive datetime would make the two bounds
    uncomparable, so reject it as a validation error (422) rather than fail later."""
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("instant must include a timezone")
    return value


def _hsk_level(value: HskLevelParam) -> int | None:
    return None if value == "none" else int(value)


class StudyController(IController):
    def __init__(self, service: StudyService, insight_service: InsightService) -> None:
        self._service = service
        self._insights = insight_service

    def router(self) -> APIRouter:
        router = APIRouter(tags=["study"], prefix="/study-items")

        @router.post("", status_code=201)
        async def add(body: AddStudyItemRequest, response: Response) -> StudyItemResponse:
            item = await self._service.add_item(body.dictionary_entry_id)
            response.headers["Location"] = f"/study-items/{item.id}"
            return StudyItemResponse.from_domain(item)

        @router.post("/batch")
        async def import_batch(body: BatchImportRequest) -> BatchImportResponse:
            report = await self._service.import_batch(
                [BatchImportRow(hanzi=row.hanzi, pinyin=row.pinyin) for row in body.rows]
            )
            return BatchImportResponse.from_domain(report)

        @router.get("")
        async def list_items(
            due: bool = False,
            leech: bool = False,
            state: Annotated[list[StateParam] | None, Query()] = None,
            hsk_level: Annotated[list[HskLevelParam] | None, Query()] = None,
            pos_tag: Annotated[list[str] | None, Query()] = None,
            search: Annotated[str, AfterValidator(_trimmed_search)] | None = None,
            due_from: Annotated[datetime, AfterValidator(_aware_instant)] | None = None,
            due_to: Annotated[datetime, AfterValidator(_aware_instant)] | None = None,
            sort: StudyItemSort | None = None,
            limit: Annotated[int, Query(ge=1, le=100)] = 20,
            offset: Annotated[int, Query(ge=0)] = 0,
        ) -> PageResponse[StudyItemResponse]:
            filters = StudyItemFilters(
                due=due,
                leech=leech,
                states=tuple(SrsState[value.upper()] for value in state or ()),
                hsk_levels=tuple(_hsk_level(value) for value in hsk_level or ()),
                pos_tags=tuple(pos_tag or ()),
                search=search,
                due_from=due_from,
                due_to=due_to,
                sort=sort,
            )
            page = await self._service.list_items(filters, limit=limit, offset=offset)
            flags = await self._insights.leech_flags([item.id for item in page.items])
            return page_response(
                page,
                lambda item: StudyItemResponse.from_domain(item, is_leech=flags.get(item.id, False)),
            )

        @router.get("/{item_id}")
        async def get(item_id: int) -> StudyItemResponse:
            item = await self._service.get_item(item_id)
            flags = await self._insights.leech_flags([item.id])
            return StudyItemResponse.from_domain(item, is_leech=flags.get(item.id, False))

        @router.post("/{item_id}/reviews", status_code=201)
        async def review(item_id: int, body: ReviewRequest, response: Response) -> ReviewResponse:
            result = await self._service.review_item(item_id, body.to_domain())
            response.headers["Location"] = f"/study-items/{item_id}/reviews"
            return ReviewResponse.from_domain(result)

        @router.get("/{item_id}/reviews")
        async def list_reviews(
            item_id: int,
            limit: Annotated[int, Query(ge=1, le=200)] = 50,
            offset: Annotated[int, Query(ge=0)] = 0,
        ) -> list[ReviewLogResponse]:
            logs = await self._service.item_reviews(item_id, limit=limit, offset=offset)
            return [ReviewLogResponse.from_domain(log) for log in logs]

        @router.post("/{item_id}/priority")
        async def prioritise(item_id: int, body: PriorityRequest) -> StudyItemResponse:
            return StudyItemResponse.from_domain(await self._service.prioritise(item_id, body.to_domain()))

        @router.delete("/{item_id}/priority", status_code=204)
        async def deprioritise(item_id: int) -> None:
            await self._service.deprioritise(item_id)

        return router
