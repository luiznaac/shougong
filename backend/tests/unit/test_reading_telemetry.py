"""Contract tests for the reading slice's signals — learner content stays out."""

from __future__ import annotations

import random
from collections.abc import Iterator, Sequence

import pytest
from opentelemetry.sdk._logs import ReadableLogRecord
from opentelemetry.sdk.metrics.export import InMemoryMetricReader

from shougong.application.telemetry import Telemetry, build_telemetry
from shougong.usecase.commons.logging import configure_logging
from shougong.usecase.commons.time import FixedClock
from shougong.usecase.reading.gateway import SegmentedToken
from shougong.usecase.reading.model import (
    PartOfSpeech,
    ReadingFailureCode,
    ReadingFormat,
    ReadingGenerationError,
    ReadingRequest,
)
from shougong.usecase.reading.service import ReadingService
from shougong.usecase.reading.telemetry import ReadingTelemetry
from tests.fixtures import (
    FakeDictionaryRepository,
    FakeReadingHistoryRepository,
    FakeReadingResponse,
    FakeReadingTextGateway,
    FakeReadingTopicRepository,
    FakeReadingWordUsageRepository,
    FakeSegmenter,
    FakeStudyItemRepository,
    build_test_settings,
    log_records,
    make_dictionary_entry,
    make_segmented_token,
    make_study_item,
    metric,
    metric_names,
)

_CORRECTION_ATTEMPT_BUCKETS = (1, 2, 3, 4, 5, 6)
_EXTRA_WORD_BUCKETS = (0, 1, 2, 3, 5, 8, 13, 21)
_GENAI_DURATION_BUCKETS = (
    0.01,
    0.02,
    0.04,
    0.08,
    0.16,
    0.32,
    0.64,
    1.28,
    2.56,
    5.12,
    10.24,
    20.48,
    40.96,
    81.92,
    163.84,
    327.68,
    655.36,
)


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


def _tok(text: str, pos: PartOfSpeech | None = PartOfSpeech.NOUN) -> SegmentedToken:
    return make_segmented_token(text, part_of_speech=pos)


# --- reading.generated + correction/extra-word/budget ----------------------


def test_a_saved_first_draft_records_the_generated_counter_and_histograms(telemetry: Telemetry) -> None:
    reading = ReadingTelemetry(telemetry.meter)

    reading.record_generated(
        reading_format=ReadingFormat.PARAGRAPH,
        model="claude-haiku-4-5",
        corrected=False,
        attempts=1,
        extra_words=2,
        budget_exceeded=False,
    )

    generated = metric(telemetry, "reading.generated")
    assert generated.unit == "{reading}"
    assert type(generated.data).__name__ == "Sum"
    (point,) = generated.data.data_points
    assert point.value == 1
    assert dict(point.attributes) == {
        "reading.format": "paragraph",
        "gen_ai.request.model": "claude-haiku-4-5",
        "reading.corrected": "false",
    }

    attempts = metric(telemetry, "reading.correction_attempts")
    assert attempts.unit == "{attempt}"
    assert type(attempts.data).__name__ == "Histogram"
    (attempt_point,) = attempts.data.data_points
    assert attempt_point.count == 1
    assert attempt_point.sum == 1
    assert attempt_point.explicit_bounds == _CORRECTION_ATTEMPT_BUCKETS
    assert dict(attempt_point.attributes) == {"reading.format": "paragraph"}

    extras = metric(telemetry, "reading.extra_words")
    assert extras.unit == "{word}"
    assert type(extras.data).__name__ == "Histogram"
    (extra_point,) = extras.data.data_points
    assert extra_point.count == 1
    assert extra_point.sum == 2
    assert extra_point.explicit_bounds == _EXTRA_WORD_BUCKETS
    assert dict(extra_point.attributes) == {"reading.format": "paragraph"}

    assert "reading.budget_exceeded" not in metric_names(telemetry)
    assert _records(telemetry) == []


def test_a_corrected_draft_marks_the_counter_and_counts_the_budget_overrun(telemetry: Telemetry) -> None:
    reading = ReadingTelemetry(telemetry.meter)

    reading.record_generated(
        reading_format=ReadingFormat.DIALOGUE,
        model="_OTHER",
        corrected=True,
        attempts=3,
        extra_words=4,
        budget_exceeded=True,
    )

    (generated,) = metric(telemetry, "reading.generated").data.data_points
    assert dict(generated.attributes) == {
        "reading.format": "dialogue",
        "gen_ai.request.model": "_OTHER",
        "reading.corrected": "true",
    }
    (attempts,) = metric(telemetry, "reading.correction_attempts").data.data_points
    assert attempts.sum == 3

    exceeded = metric(telemetry, "reading.budget_exceeded")
    assert exceeded.unit == "{reading}"
    assert type(exceeded.data).__name__ == "Sum"
    (exceeded_point,) = exceeded.data.data_points
    assert exceeded_point.value == 1
    assert dict(exceeded_point.attributes) == {"reading.format": "dialogue"}


# --- reading.generation_failed --------------------------------------------


def test_a_terminal_failure_records_the_bounded_error_type(telemetry: Telemetry) -> None:
    reading = ReadingTelemetry(telemetry.meter)

    reading.record_generation_failed(reading_format=ReadingFormat.SENTENCES, model="_OTHER", error_type="timeout")

    failed = metric(telemetry, "reading.generation_failed")
    assert failed.unit == "{reading}"
    assert type(failed.data).__name__ == "Sum"
    (point,) = failed.data.data_points
    assert point.value == 1
    assert dict(point.attributes) == {
        "reading.format": "sentences",
        "gen_ai.request.model": "_OTHER",
        "error.type": "timeout",
    }
    assert _records(telemetry) == []


# --- GenAI tokens and duration --------------------------------------------


def test_a_successful_attempt_records_tokens_and_an_unlabelled_duration(telemetry: Telemetry) -> None:
    reading = ReadingTelemetry(telemetry.meter)

    reading.record_attempt_succeeded(model="claude-haiku-4-5", input_tokens=640, output_tokens=92, duration=12.5)

    token_attributes = {
        "gen_ai.operation.name": "chat",
        "gen_ai.provider.name": "litellm",
        "gen_ai.request.model": "claude-haiku-4-5",
        "gen_ai.token.modality": "text",
    }
    for name, value in (
        ("gen_ai.client.inference.usage.input_tokens", 640),
        ("gen_ai.client.inference.usage.output_tokens", 92),
    ):
        counter = metric(telemetry, name)
        assert counter.unit == "{token}"
        assert type(counter.data).__name__ == "Sum"
        (point,) = counter.data.data_points
        assert point.value == value
        assert dict(point.attributes) == token_attributes

    duration = metric(telemetry, "gen_ai.client.inference.duration")
    assert duration.unit == "s"
    assert type(duration.data).__name__ == "Histogram"
    (point,) = duration.data.data_points
    assert point.count == 1
    assert point.sum == 12.5
    assert point.explicit_bounds == _GENAI_DURATION_BUCKETS
    assert dict(point.attributes) == {
        "gen_ai.operation.name": "chat",
        "gen_ai.provider.name": "litellm",
        "gen_ai.request.model": "claude-haiku-4-5",
    }


def test_a_failed_attempt_records_only_a_duration_with_its_error_type(telemetry: Telemetry) -> None:
    reading = ReadingTelemetry(telemetry.meter)

    reading.record_attempt_failed(model="_OTHER", error_type="gateway_rate_limited", duration=0.25)

    assert "gen_ai.client.inference.usage.input_tokens" not in metric_names(telemetry)
    assert "gen_ai.client.inference.usage.output_tokens" not in metric_names(telemetry)

    (point,) = metric(telemetry, "gen_ai.client.inference.duration").data.data_points
    assert point.count == 1
    assert point.sum == 0.25
    assert dict(point.attributes) == {
        "gen_ai.operation.name": "chat",
        "gen_ai.provider.name": "litellm",
        "gen_ai.request.model": "_OTHER",
        "error.type": "gateway_rate_limited",
    }


# --- reading.generation_degraded ------------------------------------------


def test_a_degraded_generation_warns_once_with_counts_only(telemetry: Telemetry) -> None:
    reading = ReadingTelemetry(telemetry.meter)

    reading.record_generation_degraded(
        reading_format=ReadingFormat.PARAGRAPH,
        attempts=3,
        extra_words=5,
        problems=2,
    )

    (record,) = _records(telemetry)
    assert record.body == "reading.generation_degraded"
    assert record.severity_text == "WARN"
    assert dict(record.attributes) == {
        "reading.format": "paragraph",
        "reading.attempts": 3,
        "reading.extra_words": 5,
        "reading.problems": 2,
    }


# --- scope ----------------------------------------------------------------


def test_the_reading_meter_scope_is_the_service_name(telemetry: Telemetry) -> None:
    ReadingTelemetry(telemetry.meter).record_generation_failed(
        reading_format=ReadingFormat.PARAGRAPH, model="_OTHER", error_type="timeout"
    )

    reader = telemetry.metric_reader
    assert isinstance(reader, InMemoryMetricReader)
    data = reader.get_metrics_data()
    assert data is not None
    scopes = [
        scope_metric.scope
        for resource_metric in data.resource_metrics
        for scope_metric in resource_metric.scope_metrics
        if any(item.name == "reading.generation_failed" for item in scope_metric.metrics)
    ]
    assert len(scopes) == 1
    assert scopes[0].name == "shougong"
    assert scopes[0].version


async def test_a_dialogue_generation_emits_no_log_record(telemetry: Telemetry) -> None:
    ge = make_dictionary_entry(entry_id=1, simplified="哥哥", pinyin="ge1 ge5", definitions=("older brother",))
    mei = make_dictionary_entry(entry_id=2, simplified="妹妹", pinyin="mei4 mei5", definitions=("younger sister",))
    hao = make_dictionary_entry(entry_id=3, simplified="好", pinyin="hao3", definitions=("good",))
    service = ReadingService(
        FakeReadingTextGateway(
            {
                "text": "好。好。",
                "lines": [{"speaker": "哥哥", "text": "好。"}, {"speaker": "妹妹", "text": "好。"}],
            }
        ),
        FakeSegmenter(
            {
                "好。好。": (_tok("好"), _tok("。", None), _tok("好"), _tok("。", None)),
                "好。": (_tok("好"), _tok("。", None)),
            }
        ),
        FakeStudyItemRepository([make_study_item(item_id=i, entry=e) for i, e in enumerate((ge, mei, hao), 1)]),
        FakeDictionaryRepository(),
        FakeReadingHistoryRepository(),
        FakeReadingWordUsageRepository(),
        FakeReadingTopicRepository(),
        FixedClock(make_study_item().created_at),
        ReadingTelemetry(telemetry.meter),
        rng=random.Random(0),
    )

    await service.generate(ReadingRequest(format=ReadingFormat.DIALOGUE, max_extra_words=0, model="test-model"))

    assert log_records(telemetry) == []


# --- service wiring -------------------------------------------------------

_WO = make_dictionary_entry(entry_id=1, simplified="我", pinyin="wo3")
_SHI = make_dictionary_entry(entry_id=2, simplified="是", pinyin="shi4")
_XUE_SHENG = make_dictionary_entry(entry_id=3, simplified="学生", pinyin="xue2 sheng5")
_MAO = make_dictionary_entry(entry_id=4, simplified="猫", pinyin="mao1")


def _known() -> list:
    return [make_study_item(item_id=i, entry=e) for i, e in enumerate((_WO, _SHI, _XUE_SHENG), 1)]


def _service(
    telemetry: ReadingTelemetry,
    *,
    response: FakeReadingResponse | Sequence[FakeReadingResponse],
    segments: dict[str, tuple[SegmentedToken, ...]],
    known: list | None = None,
    history: FakeReadingHistoryRepository | None = None,
) -> tuple[ReadingService, FakeReadingHistoryRepository]:
    history = history or FakeReadingHistoryRepository()
    service = ReadingService(
        FakeReadingTextGateway(response),
        FakeSegmenter(segments),
        FakeStudyItemRepository(known if known is not None else _known()),
        FakeDictionaryRepository([_MAO]),
        history,
        FakeReadingWordUsageRepository(),
        FakeReadingTopicRepository(),
        FixedClock(make_study_item().created_at),
        telemetry,
        rng=random.Random(0),
    )
    return service, history


async def test_a_saved_reading_records_generated_once_after_the_save(telemetry: Telemetry) -> None:
    service, history = _service(
        ReadingTelemetry(telemetry.meter),
        response="我是学生。",
        segments={"我是学生。": (_tok("我"), _tok("是"), _tok("学生"), _tok("。", None))},
    )

    await service.generate(ReadingRequest(format=ReadingFormat.PARAGRAPH, max_extra_words=0, model="fake-model"))

    assert len(history.saved) == 1
    (generated,) = metric(telemetry, "reading.generated").data.data_points
    assert generated.value == 1
    assert dict(generated.attributes) == {
        "reading.format": "paragraph",
        "gen_ai.request.model": "fake-model",
        "reading.corrected": "false",
    }
    (attempts,) = metric(telemetry, "reading.correction_attempts").data.data_points
    assert attempts.sum == 1
    (extras,) = metric(telemetry, "reading.extra_words").data.data_points
    assert extras.sum == 0
    assert "reading.budget_exceeded" not in metric_names(telemetry)
    assert "reading.generation_failed" not in metric_names(telemetry)

    (input_tokens,) = metric(telemetry, "gen_ai.client.inference.usage.input_tokens").data.data_points
    assert input_tokens.value == 100
    (duration,) = metric(telemetry, "gen_ai.client.inference.duration").data.data_points
    assert duration.count == 1
    assert "error.type" not in duration.attributes
    assert _records(telemetry) == []


async def test_a_persistence_failure_records_no_generated_counter(telemetry: Telemetry) -> None:
    class _FailingHistory(FakeReadingHistoryRepository):
        async def save(self, request, reading, created_at):  # type: ignore[no-untyped-def]
            raise RuntimeError("db down")

    service, _ = _service(
        ReadingTelemetry(telemetry.meter),
        response="我是学生。",
        segments={"我是学生。": (_tok("我"), _tok("是"), _tok("学生"), _tok("。", None))},
        history=_FailingHistory(),
    )

    with pytest.raises(RuntimeError):
        await service.generate(ReadingRequest(format=ReadingFormat.PARAGRAPH, max_extra_words=0, model="fake-model"))

    assert "reading.generated" not in metric_names(telemetry)


async def test_a_corrected_reading_marks_the_counter_and_counts_every_attempt(telemetry: Telemetry) -> None:
    service, _ = _service(
        ReadingTelemetry(telemetry.meter),
        response=["我是猫。", "我是学生。"],
        segments={
            "我是猫。": (_tok("我"), _tok("是"), _tok("猫"), _tok("。", None)),
            "我是学生。": (_tok("我"), _tok("是"), _tok("学生"), _tok("。", None)),
        },
    )

    await service.generate(ReadingRequest(format=ReadingFormat.PARAGRAPH, max_extra_words=0, model="fake-model"))

    (generated,) = metric(telemetry, "reading.generated").data.data_points
    assert generated.attributes["reading.corrected"] == "true"
    (attempts,) = metric(telemetry, "reading.correction_attempts").data.data_points
    assert attempts.sum == 2
    (extras,) = metric(telemetry, "reading.extra_words").data.data_points
    assert extras.sum == 0
    (duration,) = metric(telemetry, "gen_ai.client.inference.duration").data.data_points
    assert duration.count == 2
    assert _records(telemetry) == []


async def test_a_budget_overrun_counts_and_warns_once(telemetry: Telemetry) -> None:
    service, _ = _service(
        ReadingTelemetry(telemetry.meter),
        response="我是猫。",
        segments={"我是猫。": (_tok("我"), _tok("是"), _tok("猫"), _tok("。", None))},
    )

    await service.generate(
        ReadingRequest(format=ReadingFormat.PARAGRAPH, max_extra_words=0, model="fake-model", max_attempts=3)
    )

    (exceeded,) = metric(telemetry, "reading.budget_exceeded").data.data_points
    assert exceeded.value == 1
    (extras,) = metric(telemetry, "reading.extra_words").data.data_points
    assert extras.sum == 1

    (record,) = _records(telemetry)
    assert record.body == "reading.generation_degraded"
    assert record.severity_text == "WARN"
    assert dict(record.attributes) == {
        "reading.format": "paragraph",
        "reading.attempts": 3,
        "reading.extra_words": 1,
        "reading.problems": 0,
    }


async def test_dialogue_problems_alone_trigger_the_degraded_warn(telemetry: Telemetry) -> None:
    ge = make_dictionary_entry(entry_id=10, simplified="哥哥", pinyin="ge1 ge5")
    mei = make_dictionary_entry(entry_id=11, simplified="妹妹", pinyin="mei4 mei5")
    hao = make_dictionary_entry(entry_id=12, simplified="好", pinyin="hao3")
    service, _ = _service(
        ReadingTelemetry(telemetry.meter),
        response={
            "text": "好。好。",
            "lines": [{"speaker": "哥哥", "text": "好。"}, {"speaker": "哥哥", "text": "好。"}],
        },
        segments={
            "好。好。": (_tok("好"), _tok("。", None), _tok("好"), _tok("。", None)),
            "好。": (_tok("好"), _tok("。", None)),
        },
        known=[make_study_item(item_id=i, entry=e) for i, e in enumerate((ge, mei, hao), 1)],
    )

    await service.generate(
        ReadingRequest(format=ReadingFormat.DIALOGUE, max_extra_words=0, model="fake-model", max_attempts=1)
    )

    assert "reading.budget_exceeded" not in metric_names(telemetry)
    (record,) = _records(telemetry)
    assert record.body == "reading.generation_degraded"
    assert record.severity_text == "WARN"
    assert record.attributes["reading.problems"] == 2


async def test_a_failed_generation_records_a_duration_and_the_failure_then_raises(telemetry: Telemetry) -> None:
    service, _ = _service(
        ReadingTelemetry(telemetry.meter),
        response=ReadingGenerationError("boom", ReadingFailureCode.TIMEOUT),
        segments={},
        known=[],
    )

    with pytest.raises(ReadingGenerationError):
        await service.generate(ReadingRequest(format=ReadingFormat.PARAGRAPH, max_extra_words=0, model="fake-model"))

    (failed,) = metric(telemetry, "reading.generation_failed").data.data_points
    assert failed.value == 1
    assert dict(failed.attributes) == {
        "reading.format": "paragraph",
        "gen_ai.request.model": "fake-model",
        "error.type": "timeout",
    }
    assert "reading.generated" not in metric_names(telemetry)
    assert "gen_ai.client.inference.usage.input_tokens" not in metric_names(telemetry)
    (duration,) = metric(telemetry, "gen_ai.client.inference.duration").data.data_points
    assert duration.count == 1
    assert duration.attributes["error.type"] == "timeout"


async def test_a_failure_after_a_successful_attempt_keeps_the_success_tokens(telemetry: Telemetry) -> None:
    service, _ = _service(
        ReadingTelemetry(telemetry.meter),
        response=["我是猫。", ReadingGenerationError("boom", ReadingFailureCode.NO_TOOL_CALL)],
        segments={"我是猫。": (_tok("我"), _tok("是"), _tok("猫"), _tok("。", None))},
    )

    with pytest.raises(ReadingGenerationError):
        await service.generate(
            ReadingRequest(format=ReadingFormat.PARAGRAPH, max_extra_words=0, model="fake-model", max_attempts=3)
        )

    (input_tokens,) = metric(telemetry, "gen_ai.client.inference.usage.input_tokens").data.data_points
    assert input_tokens.value == 100
    duration_points = metric(telemetry, "gen_ai.client.inference.duration").data.data_points
    assert sum(point.count for point in duration_points) == 2
    (failed_duration,) = [point for point in duration_points if point.attributes.get("error.type") == "no_tool_call"]
    assert failed_duration.count == 1
    assert metric(telemetry, "reading.generation_failed").data.data_points[0].value == 1
    assert "reading.generated" not in metric_names(telemetry)


async def test_an_unlisted_model_is_labelled_other(telemetry: Telemetry) -> None:
    service, _ = _service(
        ReadingTelemetry(telemetry.meter),
        response="我是学生。",
        segments={"我是学生。": (_tok("我"), _tok("是"), _tok("学生"), _tok("。", None))},
    )

    await service.generate(
        ReadingRequest(format=ReadingFormat.PARAGRAPH, max_extra_words=0, model="caller-supplied-nonsense")
    )

    (generated,) = metric(telemetry, "reading.generated").data.data_points
    assert generated.attributes["gen_ai.request.model"] == "_OTHER"


async def test_no_request_counter_and_no_custom_reading_duration_exist(telemetry: Telemetry) -> None:
    service, _ = _service(
        ReadingTelemetry(telemetry.meter),
        response="我是学生。",
        segments={"我是学生。": (_tok("我"), _tok("是"), _tok("学生"), _tok("。", None))},
    )

    await service.generate(ReadingRequest(format=ReadingFormat.PARAGRAPH, max_extra_words=0, model="fake-model"))

    names = metric_names(telemetry)
    assert "reading.request" not in names
    assert not any(name.startswith("reading.") and name.endswith("duration") for name in names)


def test_the_reading_instruments_export_only_their_allowlisted_attributes(telemetry: Telemetry) -> None:
    telemetry.meter.create_counter("reading.generated", unit="{reading}").add(
        1,
        {
            "reading.format": "paragraph",
            "gen_ai.request.model": "claude-haiku-4-5",
            "reading.corrected": "false",
            "reading.text": "我是学生。",
            "topic": "viagem",
        },
    )

    (point,) = metric(telemetry, "reading.generated").data.data_points
    assert set(point.attributes) == {"reading.format", "gen_ai.request.model", "reading.corrected"}
