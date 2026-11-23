"""Contract tests for the dictionary instruments and curated events."""

from __future__ import annotations

import gzip
from collections.abc import Iterator

import httpx
import pytest
from opentelemetry.sdk._logs import ReadableLogRecord
from opentelemetry.sdk.metrics.export import InMemoryMetricReader, Sum
from pytest_httpserver import HTTPServer

from shougong.application.telemetry import Telemetry, build_telemetry
from shougong.gateway.dictionary.cedict_source import CedictSource
from shougong.usecase.commons.logging import configure_logging
from shougong.usecase.commons.request_context import job_context
from shougong.usecase.dictionary.model import CedictRecord
from shougong.usecase.dictionary.service import DictionaryService
from shougong.usecase.dictionary.telemetry import DictionaryTelemetry
from tests.fixtures import (
    FakeCedictSource,
    FakeDictionaryRepository,
    FakeHskDatasetSource,
    FakeOfficialHskSource,
    build_test_settings,
    log_records,
    make_dictionary_entry,
    metric,
)

_SAMPLE_CEDICT = "學 学 [xue2] /to learn/\n水 水 [shui3] /water/\n"

_RECORDS = [
    CedictRecord(simplified="学", pinyin="xue2", definitions=("to learn",)),
    CedictRecord(simplified="水", pinyin="shui3", definitions=("water",)),
]


@pytest.fixture
def telemetry() -> Iterator[Telemetry]:
    instance = build_telemetry(build_test_settings())
    configure_logging("INFO", json=True)
    instance.install_log_bridge()
    try:
        yield instance
    finally:
        instance.shutdown()


def _service(telemetry: Telemetry, repository: FakeDictionaryRepository) -> DictionaryService:
    return DictionaryService(repository, DictionaryTelemetry(telemetry.meter), enrichment_version=1)


def _bodies(telemetry: Telemetry) -> list[str]:
    return [record.log_record.body for record in log_records(telemetry)]


def _record(telemetry: Telemetry, body: str) -> ReadableLogRecord:
    matches = [item.log_record for item in log_records(telemetry) if item.log_record.body == body]
    assert len(matches) == 1, f"expected exactly one {body!r} record, got {len(matches)}"
    return matches[0]


def _metric_names(telemetry: Telemetry) -> set[str]:
    reader = telemetry.metric_reader
    assert isinstance(reader, InMemoryMetricReader)
    data = reader.get_metrics_data()
    if data is None:
        return set()
    return {
        item.name
        for resource_metric in data.resource_metrics
        for scope_metric in resource_metric.scope_metrics
        for item in scope_metric.metrics
    }


async def test_a_hit_and_a_miss_each_fire_the_search_counter_once(telemetry: Telemetry) -> None:
    service = _service(telemetry, FakeDictionaryRepository([make_dictionary_entry(simplified="学")]))

    await service.search("学")
    await service.search("zzz")

    searched = metric(telemetry, "dictionary.searched")
    assert searched.unit == "{search}"
    assert isinstance(searched.data, Sum)
    assert searched.data.is_monotonic
    by_result = {point.attributes["result"]: point for point in searched.data.data_points}
    assert {result: point.value for result, point in by_result.items()} == {"hit": 1, "miss": 1}
    assert all(dict(point.attributes) == {"result": result} for result, point in by_result.items())
    assert log_records(telemetry) == []


def test_a_failed_autoload_records_the_stage_and_one_error(telemetry: Telemetry) -> None:
    collaborator = DictionaryTelemetry(telemetry.meter)

    with job_context("job-123"):
        try:
            raise RuntimeError("cedict unreachable")
        except RuntimeError as error:
            collaborator.record_autoload_failed("populate", error)

    failures = metric(telemetry, "dictionary.autoload_failed")
    assert failures.unit == "{failure}"
    assert isinstance(failures.data, Sum)
    assert failures.data.is_monotonic
    point = failures.data.data_points[0]
    assert point.value == 1
    assert dict(point.attributes) == {"dictionary.stage": "populate"}

    record = _record(telemetry, "dictionary.autoload_failed")
    assert record.severity_text == "ERROR"
    attributes = dict(record.attributes)
    stacktrace = attributes.pop("exception.stacktrace")
    assert "RuntimeError: cedict unreachable" in stacktrace
    assert attributes == {
        "dictionary.stage": "populate",
        "job.id": "job-123",
        "exception.type": "RuntimeError",
        "exception.message": "cedict unreachable",
    }


async def test_the_bootstrap_outcomes_are_info_events_with_their_exact_attributes(telemetry: Telemetry) -> None:
    await _service(telemetry, FakeDictionaryRepository()).populate_if_empty(FakeCedictSource(_RECORDS))
    await _service(telemetry, FakeDictionaryRepository([make_dictionary_entry()])).populate_if_empty(
        FakeCedictSource(_RECORDS)
    )
    official = FakeOfficialHskSource({"书": 3})
    community = FakeHskDatasetSource({"书": ("n",)})
    await _service(telemetry, FakeDictionaryRepository([make_dictionary_entry(simplified="书")])).enrich_hsk(
        official, community
    )
    await _service(
        telemetry,
        FakeDictionaryRepository([make_dictionary_entry(hsk_level=1, pos_tags=("n",))], enrichment_version=1),
    ).enrich_hsk(official, community)

    records = [item.log_record for item in log_records(telemetry)]
    assert [record.severity_text for record in records] == ["INFO"] * 7
    assert [(record.body, dict(record.attributes)) for record in records] == [
        ("dictionary.source_downloaded", {"dictionary.source": "cedict", "dictionary.records": 2}),
        ("dictionary.populated", {"dictionary.records": 2}),
        ("dictionary.populate_skipped", {"dictionary.existing": 1}),
        ("dictionary.source_downloaded", {"dictionary.source": "official-hsk", "dictionary.records": 1}),
        ("dictionary.source_downloaded", {"dictionary.source": "community-hsk", "dictionary.records": 1}),
        ("dictionary.hsk_enriched", {"dictionary.records": 1}),
        ("dictionary.hsk_enrich_skipped", {"dictionary.enrichment_version": 1}),
    ]
    assert not any(body.endswith(".started") or body.endswith(".finished") for body in _bodies(telemetry))


async def test_a_skipped_autoload_records_no_failure(telemetry: Telemetry) -> None:
    await _service(telemetry, FakeDictionaryRepository([make_dictionary_entry()])).populate_if_empty(
        FakeCedictSource(_RECORDS)
    )

    assert _bodies(telemetry) == ["dictionary.populate_skipped"]
    assert not any(record.log_record.severity_text == "ERROR" for record in log_records(telemetry))
    assert "dictionary.autoload_failed" not in _metric_names(telemetry)


async def test_the_gateway_download_is_reported_only_by_the_collaborator(
    telemetry: Telemetry, httpserver: HTTPServer
) -> None:
    httpserver.expect_request("/cedict.gz").respond_with_data(
        gzip.compress(_SAMPLE_CEDICT.encode("utf-8")),
        content_type="application/gzip",
    )

    async with httpx.AsyncClient() as client:
        source = CedictSource(client, httpserver.url_for("/cedict.gz"))
        await _service(telemetry, FakeDictionaryRepository()).populate_if_empty(source)

    records = [
        item.log_record
        for item in log_records(telemetry)
        if item.log_record.body.startswith(("dictionary.", "cedict.", "hsk."))
    ]
    assert [(record.body, dict(record.attributes)) for record in records] == [
        ("dictionary.source_downloaded", {"dictionary.source": "cedict", "dictionary.records": 2}),
        ("dictionary.populated", {"dictionary.records": 2}),
    ]


async def test_the_dictionary_meter_scope_is_the_service_name(telemetry: Telemetry) -> None:
    await _service(telemetry, FakeDictionaryRepository()).search("学")

    reader = telemetry.metric_reader
    assert isinstance(reader, InMemoryMetricReader)
    data = reader.get_metrics_data()
    assert data is not None
    scopes = [
        scope_metric.scope
        for resource_metric in data.resource_metrics
        for scope_metric in resource_metric.scope_metrics
        if any(item.name == "dictionary.searched" for item in scope_metric.metrics)
    ]
    assert len(scopes) == 1
    assert scopes[0].name == "shougong"
    assert scopes[0].version == telemetry.resource.attributes["service.version"]
