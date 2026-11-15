"""Contract tests for the strokes cache-outcome counters and the warm failure record."""

from __future__ import annotations

import asyncio
from collections.abc import Iterator
from typing import Any

import pytest
from opentelemetry.sdk.metrics.export import InMemoryMetricReader, Sum

from shougong.application.telemetry import Telemetry, build_telemetry
from shougong.usecase.commons.exceptions import ResourceNotFoundError
from shougong.usecase.commons.logging import configure_logging
from shougong.usecase.strokes.model import CharacterStrokes, StrokeLookupResult
from shougong.usecase.strokes.service import StrokeService
from shougong.usecase.strokes.telemetry import StrokesTelemetry
from tests.fixtures import (
    FakeHanziStrokeSource,
    FakeStrokeRepository,
    build_test_settings,
    log_records,
    make_character_strokes,
    metrics_by_name,
)


class _ExplodingSource:
    """A source whose CDN call fails — structurally satisfies `IHanziStrokeSource`."""

    async def fetch(self, character: str) -> CharacterStrokes | None:
        raise RuntimeError("cdn unreachable")


@pytest.fixture
def telemetry() -> Iterator[Telemetry]:
    instance = build_telemetry(build_test_settings())
    configure_logging("INFO", json=True)
    instance.install_log_bridge()
    try:
        yield instance
    finally:
        instance.shutdown()


def _service(
    telemetry: Telemetry,
    *,
    repository: FakeStrokeRepository | None = None,
    source: FakeHanziStrokeSource | _ExplodingSource | None = None,
) -> StrokeService:
    return StrokeService(
        repository if repository is not None else FakeStrokeRepository(),
        source if source is not None else FakeHanziStrokeSource(),
        StrokesTelemetry(telemetry.meter),
    )


def _counter(telemetry: Telemetry, name: str) -> Any:
    metric = metrics_by_name(telemetry)[name]
    assert metric.unit == "{lookup}"
    assert isinstance(metric.data, Sum)
    return metric.data.data_points[0]


async def test_a_positive_cache_hit_records_only_the_hit_counter(telemetry: Telemetry) -> None:
    repository = FakeStrokeRepository()
    strokes = make_character_strokes(character="学")
    repository.rows["学"] = StrokeLookupResult(character="学", strokes=strokes)
    source = FakeHanziStrokeSource()
    service = _service(telemetry, repository=repository, source=source)

    assert await service.get("学") == strokes

    assert source.fetch_calls == 0
    assert set(metrics_by_name(telemetry)) == {"strokes.lookup_hit"}
    point = _counter(telemetry, "strokes.lookup_hit")
    assert point.value == 1
    assert point.attributes == {}
    assert log_records(telemetry) == []


async def test_a_fetch_records_only_the_fetched_counter(telemetry: Telemetry) -> None:
    strokes = make_character_strokes(character="水")
    source = FakeHanziStrokeSource({"水": strokes})
    service = _service(telemetry, source=source)

    assert await service.get("水") == strokes

    assert source.fetch_calls == 1
    assert set(metrics_by_name(telemetry)) == {"strokes.lookup_fetched"}
    point = _counter(telemetry, "strokes.lookup_fetched")
    assert point.value == 1
    assert point.attributes == {}
    assert log_records(telemetry) == []


async def test_a_source_miss_records_only_the_missed_counter(telemetry: Telemetry) -> None:
    source = FakeHanziStrokeSource({"。": None})
    service = _service(telemetry, source=source)

    with pytest.raises(ResourceNotFoundError):
        await service.get("。")

    assert set(metrics_by_name(telemetry)) == {"strokes.lookup_missed"}
    point = _counter(telemetry, "strokes.lookup_missed")
    assert point.value == 1
    assert point.attributes == {}
    assert log_records(telemetry) == []


async def test_a_negative_cache_hit_records_the_missed_counter(telemetry: Telemetry) -> None:
    repository = FakeStrokeRepository()
    repository.rows["。"] = StrokeLookupResult(character="。", strokes=None)
    source = FakeHanziStrokeSource({"。": None})
    service = _service(telemetry, repository=repository, source=source)

    with pytest.raises(ResourceNotFoundError):
        await service.get("。")

    # The caller's negative-cache hit is one miss, with no synchronous fetch.
    assert source.fetch_calls == 0
    assert set(metrics_by_name(telemetry)) == {"strokes.lookup_missed"}
    assert _counter(telemetry, "strokes.lookup_missed").value == 1

    await asyncio.sleep(0)  # the scheduled retry is a second, real lookup — it misses too
    assert _counter(telemetry, "strokes.lookup_missed").value == 2
    assert log_records(telemetry) == []


async def test_a_warm_failure_emits_one_error_without_content(telemetry: Telemetry) -> None:
    service = _service(telemetry, source=_ExplodingSource())

    await service.warm("学")

    records = log_records(telemetry)
    assert len(records) == 1
    record = records[0].log_record
    assert record.body == "strokes.warm_failed"
    assert record.severity_text == "ERROR"
    assert set(record.attributes) == {"job.id", "exception.type", "exception.message", "exception.stacktrace"}
    assert record.attributes["job.id"]
    assert record.attributes["exception.type"] == "RuntimeError"
    assert record.attributes["exception.message"] == "cdn unreachable"
    assert "character" not in record.attributes
    reader = telemetry.metric_reader
    assert isinstance(reader, InMemoryMetricReader)
    assert reader.get_metrics_data() is None  # a failure is a record, not a counter


async def test_the_strokes_meter_scope_is_the_service_name(telemetry: Telemetry) -> None:
    strokes = make_character_strokes(character="水")
    await _service(telemetry, source=FakeHanziStrokeSource({"水": strokes})).get("水")

    reader = telemetry.metric_reader
    assert isinstance(reader, InMemoryMetricReader)
    data = reader.get_metrics_data()
    scopes = [
        scope_metric.scope
        for resource_metric in data.resource_metrics
        for scope_metric in resource_metric.scope_metrics
        if any(item.name.startswith("strokes.") for item in scope_metric.metrics)
    ]
    assert len(scopes) == 1
    assert scopes[0].name == "shougong"
    assert scopes[0].version
