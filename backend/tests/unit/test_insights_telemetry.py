"""Contract tests for the insights last-observed gauges.

The gauges are recorded only on the reads that already compute them, so a
collaborator built but never driven by a read exports no value at all. The
callback replays the stored snapshot; it never performs I/O.
"""

from __future__ import annotations

from collections.abc import Iterator
from datetime import UTC, datetime
from typing import Any

import pytest
from opentelemetry.sdk.metrics.export import Gauge, InMemoryMetricReader

from shougong.application.telemetry import Telemetry, build_telemetry
from shougong.usecase.commons.time import FixedClock
from shougong.usecase.insights.model import StudyCounts
from shougong.usecase.insights.overview_service import StudyOverviewService
from shougong.usecase.insights.telemetry import InsightsTelemetry
from shougong.usecase.reading.vocabulary_service import VocabularyOverviewService
from tests.fixtures import (
    FakeDictionaryRepository,
    FakeInsightRepository,
    FakeStudyItemRepository,
    build_test_settings,
    make_dictionary_entry,
    make_study_item,
    metrics_by_name,
)

_NOW = datetime(2026, 3, 10, 12, tzinfo=UTC)

_DIFFICULTY = {
    "1": 1,
    "2": 0,
    "3": 0,
    "4": 2,
    "5": 0,
    "6": 0,
    "7": 0,
    "8": 1,
    "9": 0,
    "10": 1,
    "unset": 2,
}


@pytest.fixture
def telemetry() -> Iterator[Telemetry]:
    instance = build_telemetry(build_test_settings())
    try:
        yield instance
    finally:
        instance.shutdown()


def _gauge(telemetry: Telemetry, name: str) -> Any:
    metric = metrics_by_name(telemetry)[name]
    assert isinstance(metric.data, Gauge)
    return metric


def _attributes(metric: Any, key: str) -> dict[str, int]:
    return {point.attributes[key]: point.value for point in metric.data.data_points}


def test_no_read_means_no_gauge_value(telemetry: Telemetry) -> None:
    InsightsTelemetry(telemetry.meter)

    reader = telemetry.metric_reader
    assert isinstance(reader, InMemoryMetricReader)
    assert reader.get_metrics_data() is None


def test_the_overview_gauges_report_the_last_recorded_snapshot(telemetry: Telemetry) -> None:
    insights = InsightsTelemetry(telemetry.meter)

    insights.record_overview(
        stages={"novice": 2, "apprentice": 1, "journeyman": 0, "expert": 3, "master": 0},
        difficulty={
            "1": 1,
            "2": 0,
            "3": 0,
            "4": 2,
            "5": 0,
            "6": 0,
            "7": 0,
            "8": 1,
            "9": 0,
            "10": 1,
            "unset": 2,
        },
        due_items={"learning": 1, "review": 4},
        forecast={1: 8, 2: 6, 3: 0, 4: 0, 5: 0, 6: 0, 7: 2},
        leeches=1,
    )

    items = _gauge(telemetry, "study.items")
    assert items.unit == "{item}"
    assert _attributes(items, "srs.stage") == {
        "novice": 2,
        "apprentice": 1,
        "journeyman": 0,
        "expert": 3,
        "master": 0,
    }

    difficulty = _gauge(telemetry, "study.item_difficulty")
    assert difficulty.unit == "{item}"
    assert _attributes(difficulty, "srs.difficulty") == {
        "1": 1,
        "2": 0,
        "3": 0,
        "4": 2,
        "5": 0,
        "6": 0,
        "7": 0,
        "8": 1,
        "9": 0,
        "10": 1,
        "unset": 2,
    }

    due = _gauge(telemetry, "study.due_items")
    assert due.unit == "{item}"
    assert _attributes(due, "srs.state") == {"learning": 1, "review": 4}

    forecast = _gauge(telemetry, "study.due_forecast")
    assert forecast.unit == "{item}"
    assert _attributes(forecast, "srs.horizon") == {
        "1": 8,
        "2": 6,
        "3": 0,
        "4": 0,
        "5": 0,
        "6": 0,
        "7": 2,
    }

    leeches = _gauge(telemetry, "study.leeches")
    assert leeches.unit == "{item}"
    assert [(point.value, dict(point.attributes)) for point in leeches.data.data_points] == [(1, {})]


def test_the_vocabulary_gauge_reports_the_last_recorded_count(telemetry: Telemetry) -> None:
    insights = InsightsTelemetry(telemetry.meter)

    insights.record_known_words(42)

    known = _gauge(telemetry, "vocabulary.known_words")
    assert known.unit == "{word}"
    assert [(point.value, dict(point.attributes)) for point in known.data.data_points] == [(42, {})]


async def test_the_overview_read_records_the_five_study_gauges(telemetry: Telemetry) -> None:
    insights = InsightsTelemetry(telemetry.meter)
    repository = FakeInsightRepository(
        counts=StudyCounts(total=10, learning=2, due=5, due_learning=1),
        stability=(2, 1, 0, 3, 0),
        difficulty=_DIFFICULTY,
        due_windows=[8, 6, 0, 0, 0, 0, 2],
        leeches=1,
    )
    service = StudyOverviewService(repository, FixedClock(_NOW), insights)

    await service.overview(tz_offset_minutes=0)

    assert _attributes(_gauge(telemetry, "study.items"), "srs.stage") == {
        "novice": 2,
        "apprentice": 1,
        "journeyman": 0,
        "expert": 3,
        "master": 0,
    }
    assert _attributes(_gauge(telemetry, "study.item_difficulty"), "srs.difficulty") == _DIFFICULTY
    assert _attributes(_gauge(telemetry, "study.due_items"), "srs.state") == {"learning": 1, "review": 4}
    assert _attributes(_gauge(telemetry, "study.due_forecast"), "srs.horizon") == {
        "1": 8,
        "2": 6,
        "3": 0,
        "4": 0,
        "5": 0,
        "6": 0,
        "7": 2,
    }
    leeches = _gauge(telemetry, "study.leeches")
    assert [(point.value, dict(point.attributes)) for point in leeches.data.data_points] == [(1, {})]

    # The read makes one call per existing port method, and collecting the gauges
    # replays the stored snapshot instead of touching a repository again.
    calls = (
        len(repository.counts_calls),
        len(repository.distribution_calls),
        len(repository.due_window_calls),
        repository.transition_calls,
        len(repository.leech_count_calls),
    )
    assert calls == (1, 1, 1, 1, 1)
    metrics_by_name(telemetry)
    metrics_by_name(telemetry)
    assert (
        len(repository.counts_calls),
        len(repository.distribution_calls),
        len(repository.due_window_calls),
        repository.transition_calls,
        len(repository.leech_count_calls),
    ) == calls


async def test_the_vocabulary_read_records_the_known_word_count(telemetry: Telemetry) -> None:
    insights = InsightsTelemetry(telemetry.meter)
    walk = make_dictionary_entry(entry_id=1, simplified="行", pinyin="xing2", hsk_level=2, pos_tags=("v",))
    firm = make_dictionary_entry(entry_id=2, simplified="行", pinyin="hang2", hsk_level=2, pos_tags=("n",))
    book = make_dictionary_entry(entry_id=3, simplified="书", pinyin="shu1", hsk_level=1, pos_tags=("n",))
    study = FakeStudyItemRepository(
        [
            make_study_item(item_id=1, entry=walk),
            make_study_item(item_id=2, entry=firm),
            make_study_item(item_id=3, entry=book),
        ]
    )
    dictionary = FakeDictionaryRepository([walk, firm, book])
    service = VocabularyOverviewService(study, dictionary, insights)

    await service.summary()

    known = _gauge(telemetry, "vocabulary.known_words")
    assert [(point.value, dict(point.attributes)) for point in known.data.data_points] == [(2, {})]

    # The summary makes its existing two reads; collecting the gauge adds none.
    reads = (study.list_known_entries_calls, dictionary.hsk_words_calls)
    assert reads == (1, 1)
    metrics_by_name(telemetry)
    metrics_by_name(telemetry)
    assert (study.list_known_entries_calls, dictionary.hsk_words_calls) == reads


def test_the_insights_meter_scope_is_the_service_name(telemetry: Telemetry) -> None:
    InsightsTelemetry(telemetry.meter).record_known_words(1)

    reader = telemetry.metric_reader
    assert isinstance(reader, InMemoryMetricReader)
    data = reader.get_metrics_data()
    assert data is not None
    scopes = [
        scope_metric.scope
        for resource_metric in data.resource_metrics
        for scope_metric in resource_metric.scope_metrics
        if any(item.name == "vocabulary.known_words" for item in scope_metric.metrics)
    ]
    assert len(scopes) == 1
    assert scopes[0].name == "shougong"
    assert scopes[0].version
