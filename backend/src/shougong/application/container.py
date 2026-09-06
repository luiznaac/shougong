"""Composition root — the hand-written replacement for Spring's component scan.

This is the ONE place that knows every concrete class. It builds the object
graph once at startup and exposes:

* `health_checkers` — every `IHealthChecker` implementation (like `Set<HealthChecker>`)
* `controllers`     — every `IController` implementation (like `Set<ControllerTemplate>`)
* `app`             — the wired FastAPI application

Tests build their own `Container` with fakes / a `FixedClock` and never touch
global state.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress
from zoneinfo import ZoneInfo

import anyio
import httpx
from fastapi import FastAPI
from sqlalchemy.ext.asyncio import AsyncEngine

from shougong.application.settings import Settings
from shougong.gateway.configuration.http_client import build_http_client
from shougong.gateway.dictionary.cedict_source import CedictSource
from shougong.gateway.health.app_health_gateway import AppHealthGateway
from shougong.gateway.health.http_client_health_check import HttpClientHealthCheck
from shougong.gateway.reading.litellm_reading_gateway import LiteLlmReadingGateway
from shougong.gateway.strokes.hanzi_writer_source import HanziWriterSource
from shougong.httpapi.configuration.server import build_app
from shougong.httpapi.controller.base import IController
from shougong.httpapi.controller.dictionary_controller import DictionaryController
from shougong.httpapi.controller.health_controller import HealthController
from shougong.httpapi.controller.reading_controller import ReadingController
from shougong.httpapi.controller.strokes_controller import StrokesController
from shougong.httpapi.controller.study_controller import StudyController
from shougong.httpapi.controller.study_item_history_controller import StudyItemHistoryController
from shougong.persistence.configuration.database import build_engine, build_session_factory
from shougong.persistence.configuration.transaction import SqlAlchemyTransactionTemplate
from shougong.persistence.dictionary.repository import DictionaryRepository
from shougong.persistence.health.mysql_health_check import MySqlConnectionHealthCheck
from shougong.persistence.reading.repository import ReadingHistoryRepository
from shougong.persistence.strokes.repository import StrokeRepository
from shougong.persistence.study.repository import StudyItemRepository
from shougong.persistence.study_item_history.repository import StudyItemHistoryRepository
from shougong.segmentation.jieba_segmenter import JiebaSegmenter
from shougong.segmentation.jieba_segmenter import warm_up as warm_up_jieba
from shougong.srs.fsrs_engine import FsrsEngine
from shougong.usecase.commons.logging import get_logger
from shougong.usecase.commons.time import IClock, SystemClock
from shougong.usecase.dictionary.service import DictionaryService
from shougong.usecase.health.checker import IHealthChecker
from shougong.usecase.reading.service import ReadingService
from shougong.usecase.srs.day_boundary import DayBoundaryEngine
from shougong.usecase.strokes.service import StrokeService
from shougong.usecase.study.service import StudyService
from shougong.usecase.study_item_history.service import StudyItemHistoryService

_log = get_logger(__name__)


class Container:
    def __init__(self, settings: Settings, *, clock: IClock | None = None) -> None:
        self.settings = settings
        self.clock: IClock = clock or SystemClock()

        # --- infrastructure singletons -------------------------------------
        self.engine: AsyncEngine = build_engine(settings.mysql.url)
        self._session_factory = build_session_factory(self.engine)
        self.transaction_template = SqlAlchemyTransactionTemplate(self._session_factory)
        self.http_client: httpx.AsyncClient = build_http_client()

        # --- health slice ------------------------------------------------
        self._app_health_gateway = AppHealthGateway(self.http_client, settings.gateways.app.host)
        self.health_checkers: list[IHealthChecker] = [
            MySqlConnectionHealthCheck(self.engine, self.clock),
            HttpClientHealthCheck(self._app_health_gateway, self.clock),
        ]

        # --- dictionary slice -------------------------------------------
        self._dictionary_repository = DictionaryRepository(self.transaction_template)
        self._dictionary_service = DictionaryService(self._dictionary_repository)
        self._cedict_source = CedictSource(self.http_client)

        # --- strokes slice -------------------------------------------------
        self._stroke_repository = StrokeRepository(self.transaction_template)
        self._stroke_source = HanziWriterSource(self.http_client)
        self._stroke_service = StrokeService(self._stroke_repository, self._stroke_source)

        # --- study slice ----------------------------------------------
        self._srs_engine = DayBoundaryEngine(FsrsEngine(), ZoneInfo(settings.study_timezone))
        self._study_item_history_repository = StudyItemHistoryRepository(self.transaction_template)
        self._study_item_repository = StudyItemRepository(
            self.transaction_template,
            self._study_item_history_repository,
        )
        self._study_service = StudyService(
            self._study_item_repository,
            self._dictionary_repository,
            self._srs_engine,
            self.clock,
            self.transaction_template,
            self._stroke_service,
        )
        self._study_item_history_service = StudyItemHistoryService(
            self._study_item_history_repository,
            self._study_item_repository,
            self.transaction_template,
        )

        # --- reading slice -----------------------------------------------
        self._segmenter = JiebaSegmenter()
        self._reading_gateway = LiteLlmReadingGateway(
            self.http_client,
            settings.gateways.ai.base_url,
            settings.gateways.ai.api_key,
        )
        self._reading_history_repository = ReadingHistoryRepository(self.transaction_template)
        self._reading_service = ReadingService(
            self._reading_gateway,
            self._segmenter,
            self._study_item_repository,
            self._dictionary_repository,
            self._reading_history_repository,
            self.clock,
        )

        # --- http layer ------------------------------------------------
        self.controllers: list[IController] = [
            HealthController(self.health_checkers),
            DictionaryController(self._dictionary_service),
            StrokesController(self._stroke_service),
            StudyController(self._study_service),
            StudyItemHistoryController(self._study_item_history_service),
            ReadingController(self._reading_service),
        ]

        @asynccontextmanager
        async def lifespan(_: FastAPI) -> AsyncIterator[None]:
            autoload = asyncio.create_task(self._autoload_dictionary()) if self.settings.dictionary_autoload else None
            jieba_warmup = asyncio.create_task(self._warm_up_jieba())
            try:
                yield
            finally:
                for task in (autoload, jieba_warmup):
                    if task is not None:
                        task.cancel()
                        with suppress(asyncio.CancelledError):
                            await task
                await self.aclose()

        self.app = build_app(self.controllers, lifespan=lifespan)

    async def _autoload_dictionary(self) -> None:
        """Fire-and-forget: fill the dictionary from CC-CEDICT if it is empty.

        Runs in the background so the app serves immediately; a download failure
        is logged, never fatal.
        """
        try:
            await self._dictionary_service.populate_if_empty(self._cedict_source)
        except asyncio.CancelledError:
            raise
        except Exception:
            _log.exception("dictionary.autoload.failed")

    async def _warm_up_jieba(self) -> None:
        """Fire-and-forget: force jieba's lazy dictionary load now, off the
        event loop thread, so the first real reading-generation request isn't
        the one paying for it."""
        try:
            await anyio.to_thread.run_sync(warm_up_jieba)
        except asyncio.CancelledError:
            raise
        except Exception:
            _log.exception("reading.jieba_warmup.failed")

    async def aclose(self) -> None:
        await self.http_client.aclose()
        await self.engine.dispose()
