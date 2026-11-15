"""Contract tests for the study slice's instruments and curated events.

The instruments and their closed attribute sets are pinned through the real SDK
and an in-memory reader/exporter, mirroring the health collaborator. The
service-level cases drive `StudyService` through the same meter to prove the
pre-review state, graduation transition, session-size and import-reason wiring.
"""

from __future__ import annotations

from collections.abc import Iterator
from datetime import timedelta

import pytest
from opentelemetry.sdk._logs import ReadableLogRecord
from opentelemetry.sdk.metrics.export import InMemoryMetricReader

from shougong.application.telemetry import Telemetry, build_telemetry
from shougong.usecase.commons.exceptions import ConflictError
from shougong.usecase.commons.logging import configure_logging
from shougong.usecase.commons.time import FixedClock
from shougong.usecase.srs.model import SrsRating, SrsState
from shougong.usecase.strokes.service import StrokeService
from shougong.usecase.study.model import (
    BatchImportRow,
    BatchRowStatus,
    ImportSkipReason,
    ItemSource,
    PriorityEdge,
    SessionKind,
)
from shougong.usecase.study.service import StudyService
from shougong.usecase.study.telemetry import StudyTelemetry
from tests.fixtures import (
    DeterministicShuffler,
    FakeDictionaryRepository,
    FakeHanziStrokeSource,
    FakeStrokeRepository,
    FakeStudyItemRepository,
    FakeTransactionTemplate,
    StubSrsEngine,
    build_test_settings,
    log_records,
    make_dictionary_entry,
    make_srs_card,
    make_study_item,
    metric,
    metric_names,
)

_NOW = make_srs_card().due  # 2026-01-01T00:00:00Z
_REVIEW_LAG_BUCKETS = (300, 3600, 21600, 86400, 259200, 604800, 2592000)
_SESSION_SIZE_BUCKETS = (0, 1, 5, 10, 20, 40, 80, 160)


@pytest.fixture
def telemetry() -> Iterator[Telemetry]:
    instance = build_telemetry(build_test_settings())
    configure_logging("INFO", json=True)
    instance.install_log_bridge()
    try:
        yield instance
    finally:
        instance.shutdown()


def _records(telemetry: Telemetry) -> list[ReadableLogRecord]:
    return [item.log_record for item in log_records(telemetry)]


# --- item_added -----------------------------------------------------------


def test_item_added_records_the_api_source_and_logs_the_ids_only(telemetry: Telemetry) -> None:
    study = StudyTelemetry(telemetry.meter)

    study.item_added(item_id=7, entry_id=42, source=ItemSource.API)

    added = metric(telemetry, "study.item_added")
    assert added.unit == "{item}"
    assert type(added.data).__name__ == "Sum"
    (point,) = added.data.data_points
    assert point.value == 1
    assert dict(point.attributes) == {"source": "api"}

    (record,) = _records(telemetry)
    assert record.body == "study.item_added"
    assert record.severity_text == "INFO"
    assert dict(record.attributes) == {"item_id": 7, "entry_id": 42}


def test_item_added_from_a_batch_uses_the_import_source(telemetry: Telemetry) -> None:
    study = StudyTelemetry(telemetry.meter)

    study.item_added(item_id=1, entry_id=2, source=ItemSource.IMPORT)

    (point,) = metric(telemetry, "study.item_added").data.data_points
    assert dict(point.attributes) == {"source": "import"}


# --- item_reviewed / item_graduated / review_lag --------------------------


def test_item_reviewed_records_the_rating_and_pre_review_state_metric_only(telemetry: Telemetry) -> None:
    study = StudyTelemetry(telemetry.meter)

    study.item_reviewed(rating=SrsRating.AGAIN, state=SrsState.REVIEW)

    reviewed = metric(telemetry, "study.item_reviewed")
    assert reviewed.unit == "{review}"
    assert type(reviewed.data).__name__ == "Sum"
    (point,) = reviewed.data.data_points
    assert point.value == 1
    assert dict(point.attributes) == {"rating": "again", "srs.state": "review"}
    assert _records(telemetry) == []


def test_a_lapse_is_the_again_review_cell_with_no_lapse_counter(telemetry: Telemetry) -> None:
    study = StudyTelemetry(telemetry.meter)

    study.item_reviewed(rating=SrsRating.AGAIN, state=SrsState.REVIEW)

    assert not any("lapse" in name for name in metric_names(telemetry))


def test_item_graduated_counts_with_no_attributes(telemetry: Telemetry) -> None:
    study = StudyTelemetry(telemetry.meter)

    study.item_graduated()
    study.item_graduated()

    graduated = metric(telemetry, "study.item_graduated")
    assert graduated.unit == "{item}"
    assert type(graduated.data).__name__ == "Sum"
    (point,) = graduated.data.data_points
    assert point.value == 2
    assert dict(point.attributes) == {}
    assert _records(telemetry) == []


def test_review_lag_is_a_seconds_histogram_with_the_catalog_buckets(telemetry: Telemetry) -> None:
    study = StudyTelemetry(telemetry.meter)

    study.review_lag(0)
    study.review_lag(7200)

    lag = metric(telemetry, "study.review_lag")
    assert lag.unit == "s"
    assert type(lag.data).__name__ == "Histogram"
    (point,) = lag.data.data_points
    assert point.count == 2
    assert point.sum == 7200
    assert point.explicit_bounds == _REVIEW_LAG_BUCKETS
    assert dict(point.attributes) == {}


# --- session_created / session_size ---------------------------------------


def test_session_created_records_kind_and_logs_kind_only(telemetry: Telemetry) -> None:
    study = StudyTelemetry(telemetry.meter)

    study.session_created(kind=SessionKind.LESSON, size=3)

    created = metric(telemetry, "study.session_created")
    assert created.unit == "{session}"
    assert type(created.data).__name__ == "Sum"
    (point,) = created.data.data_points
    assert point.value == 1
    assert dict(point.attributes) == {"kind": "lesson"}

    (record,) = _records(telemetry)
    assert record.body == "study.session_created"
    assert record.severity_text == "INFO"
    assert dict(record.attributes) == {"kind": "lesson"}


def test_session_size_records_one_point_per_open_including_zero(telemetry: Telemetry) -> None:
    study = StudyTelemetry(telemetry.meter)

    study.session_created(kind=SessionKind.LESSON, size=0)
    study.session_created(kind=SessionKind.LESSON, size=3)

    size = metric(telemetry, "study.session_size")
    assert size.unit == "{item}"
    assert type(size.data).__name__ == "Histogram"
    (point,) = size.data.data_points
    assert dict(point.attributes) == {"kind": "lesson"}
    assert point.count == 2
    assert point.sum == 3
    assert point.explicit_bounds == _SESSION_SIZE_BUCKETS
    assert point.bucket_counts[0] == 1  # the empty-queue open lands in le=0


# --- batch_imported / import_row_skipped ----------------------------------


def test_batch_imported_counts_once_and_logs_without_counts(telemetry: Telemetry) -> None:
    study = StudyTelemetry(telemetry.meter)

    study.batch_imported()

    imported = metric(telemetry, "study.batch_imported")
    assert imported.unit == "{batch}"
    assert type(imported.data).__name__ == "Sum"
    (point,) = imported.data.data_points
    assert point.value == 1
    assert dict(point.attributes) == {}

    (record,) = _records(telemetry)
    assert record.body == "study.batch_imported"
    assert record.severity_text == "INFO"
    assert dict(record.attributes) == {}


def test_import_row_skipped_counts_each_bounded_reason_without_a_log(telemetry: Telemetry) -> None:
    study = StudyTelemetry(telemetry.meter)

    for reason in ImportSkipReason:
        study.import_row_skipped(reason=reason)

    skipped = metric(telemetry, "study.import_row_skipped")
    assert skipped.unit == "{row}"
    assert type(skipped.data).__name__ == "Sum"
    counts = {point.attributes["reason"]: point.value for point in skipped.data.data_points}
    assert counts == {"format": 1, "not_found": 1, "ambiguous": 1, "duplicate": 1}
    assert all(set(point.attributes) == {"reason"} for point in skipped.data.data_points)
    assert _records(telemetry) == []


# --- scope ----------------------------------------------------------------


def test_the_study_meter_scope_is_the_service_name(telemetry: Telemetry) -> None:
    StudyTelemetry(telemetry.meter).item_added(item_id=1, entry_id=1, source=ItemSource.API)

    reader = telemetry.metric_reader
    assert isinstance(reader, InMemoryMetricReader)
    data = reader.get_metrics_data()
    assert data is not None
    scopes = [
        scope_metric.scope
        for resource_metric in data.resource_metrics
        for scope_metric in resource_metric.scope_metrics
        if any(item.name == "study.item_added" for item in scope_metric.metrics)
    ]
    assert len(scopes) == 1
    assert scopes[0].name == "shougong"
    assert scopes[0].version


# --- service wiring -------------------------------------------------------

_XUE_XI = make_dictionary_entry(entry_id=1, simplified="学习", pinyin="xue2 xi2")
_NI_HAO = make_dictionary_entry(entry_id=2, simplified="你好", pinyin="ni3 hao3")


def _service(
    telemetry: StudyTelemetry,
    *,
    dictionary: FakeDictionaryRepository | None = None,
    study: FakeStudyItemRepository | None = None,
) -> StudyService:
    return StudyService(
        study or FakeStudyItemRepository(),
        dictionary or FakeDictionaryRepository([make_dictionary_entry(entry_id=1)]),
        StubSrsEngine(),
        FixedClock(_NOW),
        FakeTransactionTemplate(),
        StrokeService(FakeStrokeRepository(), FakeHanziStrokeSource()),
        DeterministicShuffler(),
        telemetry,
    )


async def test_add_item_emits_the_api_source_and_the_curated_log(telemetry: Telemetry) -> None:
    entry = make_dictionary_entry(entry_id=42)
    service = _service(StudyTelemetry(telemetry.meter), dictionary=FakeDictionaryRepository([entry]))

    await service.add_item(42)

    (point,) = metric(telemetry, "study.item_added").data.data_points
    assert dict(point.attributes) == {"source": "api"}
    (record,) = _records(telemetry)
    assert record.body == "study.item_added"
    assert dict(record.attributes) == {"item_id": 1, "entry_id": 42}


async def test_a_review_reports_the_pre_review_state_and_graduates_a_learning_card(telemetry: Telemetry) -> None:
    study = FakeStudyItemRepository(
        [
            make_study_item(
                item_id=1,
                card=make_srs_card(state=SrsState.LEARNING, due=_NOW - timedelta(minutes=5)),
            )
        ]
    )
    service = _service(StudyTelemetry(telemetry.meter), study=study)

    await service.review_item(1, SrsRating.GOOD)

    (reviewed,) = metric(telemetry, "study.item_reviewed").data.data_points
    assert dict(reviewed.attributes) == {"rating": "good", "srs.state": "learning"}
    (graduated,) = metric(telemetry, "study.item_graduated").data.data_points
    assert graduated.value == 1
    (lag,) = metric(telemetry, "study.review_lag").data.data_points
    assert lag.count == 1
    assert lag.sum == 300
    assert _records(telemetry) == []


async def test_a_lapse_is_the_again_review_cell_and_does_not_graduate(telemetry: Telemetry) -> None:
    study = FakeStudyItemRepository([make_study_item(item_id=1, card=make_srs_card(state=SrsState.REVIEW, due=_NOW))])
    service = _service(StudyTelemetry(telemetry.meter), study=study)

    await service.review_item(1, SrsRating.AGAIN)

    (reviewed,) = metric(telemetry, "study.item_reviewed").data.data_points
    assert dict(reviewed.attributes) == {"rating": "again", "srs.state": "review"}
    assert "study.item_graduated" not in metric_names(telemetry)


async def test_relearning_into_review_does_not_graduate(telemetry: Telemetry) -> None:
    study = FakeStudyItemRepository(
        [make_study_item(item_id=1, card=make_srs_card(state=SrsState.RELEARNING, due=_NOW))]
    )
    service = _service(StudyTelemetry(telemetry.meter), study=study)

    await service.review_item(1, SrsRating.GOOD)

    (reviewed,) = metric(telemetry, "study.item_reviewed").data.data_points
    assert dict(reviewed.attributes) == {"rating": "good", "srs.state": "relearning"}
    assert "study.item_graduated" not in metric_names(telemetry)


async def test_a_not_yet_due_review_emits_no_review_metrics(telemetry: Telemetry) -> None:
    study = FakeStudyItemRepository(
        [
            make_study_item(
                item_id=1,
                card=make_srs_card(state=SrsState.REVIEW, due=_NOW + timedelta(days=1)),
            )
        ]
    )
    service = _service(StudyTelemetry(telemetry.meter), study=study)

    with pytest.raises(ConflictError):
        await service.review_item(1, SrsRating.GOOD)

    reader = telemetry.metric_reader
    assert isinstance(reader, InMemoryMetricReader)
    assert reader.get_metrics_data() is None
    assert _records(telemetry) == []


async def test_session_open_emits_kind_and_size_including_zero(telemetry: Telemetry) -> None:
    study = FakeStudyItemRepository([make_study_item(item_id=1), make_study_item(item_id=2)])
    service = _service(StudyTelemetry(telemetry.meter), study=study)

    await service.session(SessionKind.LESSON)
    await service.session(SessionKind.REVIEW)

    created = {
        point.attributes["kind"]: point.value for point in metric(telemetry, "study.session_created").data.data_points
    }
    assert created == {"lesson": 1, "review": 1}

    sizes = {
        point.attributes["kind"]: (point.count, point.sum)
        for point in metric(telemetry, "study.session_size").data.data_points
    }
    assert sizes == {"lesson": (1, 2), "review": (1, 0)}

    records = _records(telemetry)
    assert [record.body for record in records] == ["study.session_created", "study.session_created"]
    assert [dict(record.attributes) for record in records] == [{"kind": "lesson"}, {"kind": "review"}]


async def test_batch_import_records_created_rows_and_skipped_rows_by_reason(telemetry: Telemetry) -> None:
    hang_a = make_dictionary_entry(entry_id=10, simplified="行", pinyin="xing2")
    hang_b = make_dictionary_entry(entry_id=11, simplified="行", pinyin="xing2")
    study = FakeStudyItemRepository([make_study_item(item_id=99, entry=_NI_HAO)])
    service = _service(
        StudyTelemetry(telemetry.meter),
        dictionary=FakeDictionaryRepository([_XUE_XI, _NI_HAO, hang_a, hang_b]),
        study=study,
    )

    report = await service.import_batch(
        [
            BatchImportRow(hanzi="学习", pinyin="xue2 xi2"),
            BatchImportRow(hanzi="你好", pinyin="ni3 hao3"),
            BatchImportRow(hanzi="行", pinyin="xing2"),
            BatchImportRow(hanzi="没有", pinyin="mei2 you3"),
            BatchImportRow(hanzi="", pinyin="xue2"),
        ]
    )

    assert [outcome.status for outcome in report.outcomes] == [
        BatchRowStatus.CREATED,
        BatchRowStatus.SKIPPED,
        BatchRowStatus.ERROR,
        BatchRowStatus.ERROR,
        BatchRowStatus.ERROR,
    ]
    assert report.outcomes[3].detail == "hanzi não encontrado no dicionário"

    (added,) = metric(telemetry, "study.item_added").data.data_points
    assert added.value == 1
    assert dict(added.attributes) == {"source": "import"}

    skipped = {
        point.attributes["reason"]: point.value
        for point in metric(telemetry, "study.import_row_skipped").data.data_points
    }
    assert skipped == {"format": 1, "not_found": 1, "ambiguous": 1, "duplicate": 1}

    (imported,) = metric(telemetry, "study.batch_imported").data.data_points
    assert imported.value == 1
    assert dict(imported.attributes) == {}

    records = _records(telemetry)
    assert [record.body for record in records] == ["study.item_added", "study.batch_imported"]
    assert dict(records[0].attributes) == {"item_id": 1, "entry_id": 1}
    assert dict(records[1].attributes) == {}


async def test_priority_changes_emit_no_logs_or_metrics(telemetry: Telemetry) -> None:
    study = FakeStudyItemRepository([make_study_item(item_id=1)])
    service = _service(StudyTelemetry(telemetry.meter), study=study)

    await service.prioritise(1, PriorityEdge.FRONT)
    await service.deprioritise(1)

    reader = telemetry.metric_reader
    assert isinstance(reader, InMemoryMetricReader)
    assert reader.get_metrics_data() is None
    assert _records(telemetry) == []
