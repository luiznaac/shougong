"""`HealthController` — the one worked example endpoint.

`GET /health`          aggregates every `IHealthChecker`.
`GET /health/internal` is the cheap liveness probe `AppHealthGateway` calls.
"""

from __future__ import annotations

from collections.abc import Sequence

from fastapi import APIRouter

from shougong.httpapi.controller.base import IController
from shougong.httpapi.schema import HealthCheckResponse
from shougong.usecase.commons.asyncx import map_async
from shougong.usecase.health.checker import IHealthChecker
from shougong.usecase.health.telemetry import HealthTelemetry


class HealthController(IController):
    def __init__(self, health_checkers: Sequence[IHealthChecker], telemetry: HealthTelemetry) -> None:
        self._health_checkers = health_checkers
        self._telemetry = telemetry

    def router(self) -> APIRouter:
        router = APIRouter(tags=["health"])

        @router.get("/health")
        async def health() -> list[HealthCheckResponse]:
            results = await map_async(
                self._health_checkers,
                lambda checker: checker.get_health_status(),
            )
            for result in results:
                self._telemetry.record(result)
            return [HealthCheckResponse.from_domain(result) for result in results]

        @router.get("/health/internal")
        async def health_internal() -> dict[str, bool]:
            return {"is_healthy": True}

        return router
