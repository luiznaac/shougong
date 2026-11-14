"""The background task boundary owns a `job.id` and logs one ERROR on failure."""

from __future__ import annotations

from collections.abc import AsyncIterator, Iterator

import pytest

from shougong.application import container as container_module
from shougong.application.container import Container
from shougong.application.telemetry import Telemetry, build_telemetry
from shougong.usecase.commons.logging import configure_logging
from tests.fixtures import StubHealthChecker, build_test_settings, log_records


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
async def container(telemetry: Telemetry) -> AsyncIterator[Container]:
    instance = Container(
        build_test_settings(dictionary_autoload=True),
        telemetry=telemetry,
        health_checkers=[StubHealthChecker()],
    )
    try:
        yield instance
    finally:
        await instance.aclose()


async def _failed_records(telemetry: Telemetry, event: str) -> list[object]:
    return [item.log_record for item in log_records(telemetry) if item.log_record.body == event]


async def test_a_failed_dictionary_autoload_emits_one_error_with_a_job_id(
    container: Container, telemetry: Telemetry
) -> None:
    async def boom(*_: object) -> int:
        raise RuntimeError("cedict unreachable")

    container._dictionary_service.populate_if_empty = boom  # type: ignore[method-assign]

    await container._autoload_dictionary()

    records = await _failed_records(telemetry, "dictionary.autoload.failed")
    assert len(records) == 1
    record = records[0]
    assert record.severity_text == "ERROR"
    assert record.attributes["job.id"]
    assert record.attributes["exception.type"] == "RuntimeError"
    assert record.attributes["exception.message"] == "cedict unreachable"


async def test_a_failed_jieba_warmup_emits_one_error_with_a_job_id(
    container: Container, telemetry: Telemetry, monkeypatch: pytest.MonkeyPatch
) -> None:
    def boom() -> None:
        raise RuntimeError("jieba dictionary missing")

    monkeypatch.setattr(container_module, "warm_up_jieba", boom)

    await container._warm_up_jieba()

    records = await _failed_records(telemetry, "reading.jieba_warmup.failed")
    assert len(records) == 1
    assert records[0].severity_text == "ERROR"
    assert records[0].attributes["job.id"]
