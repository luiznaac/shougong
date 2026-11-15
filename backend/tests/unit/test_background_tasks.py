"""The background task boundary owns a `job.id` and reports one failure."""

from __future__ import annotations

from collections.abc import AsyncIterator, Callable, Iterator
from typing import Any

import pytest

from shougong.application import container as container_module
from shougong.application.container import Container
from shougong.application.telemetry import Telemetry, build_telemetry
from shougong.usecase.commons.logging import configure_logging
from tests.fixtures import StubHealthChecker, build_test_settings, log_records, metric


@pytest.fixture
def telemetry() -> Iterator[Telemetry]:
    instance = build_telemetry(build_test_settings())
    configure_logging("INFO", json=True)
    instance.install_log_bridge()
    try:
        yield instance
    finally:
        instance.shutdown()


@pytest.fixture
async def containers(telemetry: Telemetry) -> AsyncIterator[Callable[..., Container]]:
    built: list[Container] = []

    def build(**overrides: object) -> Container:
        instance = Container(
            build_test_settings(**overrides),
            telemetry=telemetry,
            health_checkers=[StubHealthChecker()],
        )
        built.append(instance)
        return instance

    try:
        yield build
    finally:
        for instance in built:
            await instance.aclose()


def _failed_records(telemetry: Telemetry, event: str) -> list[Any]:
    return [item.log_record for item in log_records(telemetry) if item.log_record.body == event]


def _failure_point(telemetry: Telemetry) -> Any:
    return metric(telemetry, "dictionary.autoload_failed").data.data_points[0]


async def test_a_failed_dictionary_autoload_records_the_populate_stage(
    containers: Callable[..., Container], telemetry: Telemetry
) -> None:
    container = containers(dictionary_autoload=True)

    async def boom(*_: object) -> int:
        raise RuntimeError("cedict unreachable")

    container._dictionary_service.populate_if_empty = boom  # type: ignore[method-assign]

    await container._autoload_dictionary()

    records = _failed_records(telemetry, "dictionary.autoload_failed")
    assert len(records) == 1
    record = records[0]
    assert record.severity_text == "ERROR"
    assert record.attributes["job.id"]
    assert record.attributes["dictionary.stage"] == "populate"
    assert record.attributes["exception.type"] == "RuntimeError"
    assert record.attributes["exception.message"] == "cedict unreachable"

    point = _failure_point(telemetry)
    assert point.value == 1
    assert dict(point.attributes) == {"dictionary.stage": "populate"}


async def test_a_failed_enrich_records_the_enrich_stage(
    containers: Callable[..., Container], telemetry: Telemetry
) -> None:
    container = containers(hsk_enrich_autoload=True)

    async def boom(*_: object) -> int:
        raise RuntimeError("hsk unreachable")

    container._dictionary_service.enrich_hsk = boom  # type: ignore[method-assign]

    await container._autoload_dictionary()

    records = _failed_records(telemetry, "dictionary.autoload_failed")
    assert len(records) == 1
    assert records[0].attributes["dictionary.stage"] == "enrich"
    assert records[0].attributes["job.id"]

    point = _failure_point(telemetry)
    assert dict(point.attributes) == {"dictionary.stage": "enrich"}


async def test_a_failed_jieba_warmup_emits_one_error_with_a_job_id(
    containers: Callable[..., Container], telemetry: Telemetry, monkeypatch: pytest.MonkeyPatch
) -> None:
    container = containers()

    def boom() -> None:
        raise RuntimeError("jieba dictionary missing")

    monkeypatch.setattr(container_module, "warm_up_jieba", boom)

    await container._warm_up_jieba()

    records = _failed_records(telemetry, "reading.jieba_warmup.failed")
    assert len(records) == 1
    assert records[0].severity_text == "ERROR"
    assert records[0].attributes["job.id"]
