"""Contract tests for the structlog → stdlib → OTel log bridge."""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import Iterator

import pytest
from opentelemetry.sdk._logs import ReadableLogRecord

from shougong.application.telemetry import Telemetry, build_telemetry
from shougong.usecase.commons.logging import configure_logging, get_logger
from shougong.usecase.commons.request_context import request_context
from tests.fixtures import build_test_settings, log_records


@pytest.fixture
def telemetry() -> Iterator[Telemetry]:
    instance = build_telemetry(build_test_settings())
    configure_logging("DEBUG", json=True, resource={"service.name": "shougong"})
    instance.install_log_bridge()
    try:
        yield instance
    finally:
        instance.shutdown()


def _only(telemetry: Telemetry) -> ReadableLogRecord:
    records = log_records(telemetry)
    assert len(records) == 1
    return records[0]


def test_body_is_the_event_name_and_attributes_are_split(telemetry: Telemetry) -> None:
    get_logger("test").info("widgets.listed", widget_count=3)

    record = _only(telemetry).log_record
    assert record.body == "widgets.listed"
    assert record.event_name == "widgets.listed"
    assert record.attributes["widget_count"] == 3
    assert "event" not in record.attributes
    assert "level" not in record.attributes
    assert "timestamp" not in record.attributes


def test_no_duplicated_level_or_timestamp_attributes(telemetry: Telemetry) -> None:
    get_logger("test").warning("widgets.deprecated")

    record = _only(telemetry).log_record
    assert record.severity_text == "WARN"
    assert "level" not in record.attributes
    assert "levelname" not in record.attributes
    assert "timestamp" not in record.attributes
    assert "asctime" not in record.attributes


def test_severity_maps_and_there_is_no_trace_context(telemetry: Telemetry) -> None:
    log = get_logger("test")
    log.debug("one")
    log.info("two")
    log.warning("three")
    log.error("four")

    records = [item.log_record for item in log_records(telemetry)]
    assert [record.severity_text for record in records] == ["DEBUG", "INFO", "WARN", "ERROR"]
    assert [record.severity_number.value for record in records] == [5, 9, 13, 17]
    assert all(not record.trace_id for record in records)
    assert all(not record.span_id for record in records)


def test_plain_framework_logs_get_the_body_stamped_as_event_name(telemetry: Telemetry) -> None:
    logging.getLogger("some.framework").warning("plain framework message")

    record = _only(telemetry).log_record
    assert record.body == "plain framework message"
    assert record.event_name == "plain framework message"
    assert record.severity_text == "WARN"


def test_request_id_is_attached_inside_the_context_and_absent_outside(telemetry: Telemetry) -> None:
    log = get_logger("test")
    with request_context("0123456789abcdef"):
        log.info("inside")
    log.info("outside")

    inside, outside = [item.log_record for item in log_records(telemetry)]
    assert inside.attributes["request.id"] == "0123456789abcdef"
    assert outside.attributes.get("request.id") is None


async def test_request_id_survives_a_coroutine_dispatch(telemetry: Telemetry) -> None:
    async def work() -> None:
        get_logger("test").info("from.task")

    with request_context("0123456789abcdef"):
        await asyncio.create_task(work())

    records = [item.log_record for item in log_records(telemetry) if item.log_record.body == "from.task"]
    assert len(records) == 1
    assert records[0].attributes["request.id"] == "0123456789abcdef"


def test_secrets_are_redacted_and_pii_passes(telemetry: Telemetry) -> None:
    get_logger("test").info(
        "auth.failed",
        password="hunter2",
        Authorization="Bearer abc",
        api_key="k-1",
        email="someone@example.com",
        request_body='{"secret":"x"}',
    )

    attributes = _only(telemetry).log_record.attributes
    assert attributes["password"] == "[REDACTED]"
    assert attributes["Authorization"] == "[REDACTED]"
    assert attributes["api_key"] == "[REDACTED]"
    assert attributes["email"] == "someone@example.com"
    assert "request_body" not in attributes


def test_learner_content_keys_are_dropped_before_export(telemetry: Telemetry) -> None:
    get_logger("test").info(
        "dictionary.searched",
        query="知道",
        text="一段文字",
        content="一段文字",
        pinyin="zhi1 dao4",
        hanzi="知道",
        character="知",
        reading="一段文字",
        topic="food",
        topics=["food"],
        names=["小明", "小红"],
        speakers=["小明"],
        prompt="write a reading",
        completion="一段文字",
        **{"reading.format": "dialogue", "reading.attempts": 2, "dictionary.source": "cedict"},
    )

    attributes = _only(telemetry).log_record.attributes
    for key in (
        "query",
        "text",
        "content",
        "pinyin",
        "hanzi",
        "character",
        "reading",
        "topic",
        "topics",
        "names",
        "speakers",
        "prompt",
        "completion",
    ):
        assert key not in attributes, key
    assert attributes["reading.format"] == "dialogue"
    assert attributes["reading.attempts"] == 2
    assert attributes["dictionary.source"] == "cedict"


def test_the_content_denylist_matches_the_whole_key_never_a_substring(telemetry: Telemetry) -> None:
    get_logger("test").info(
        "dictionary.searched",
        **{"query.length": 2, "text.length": 4, "content_type": "application/json", "speakers_count": 2},
    )

    attributes = _only(telemetry).log_record.attributes
    assert attributes == {
        "query.length": 2,
        "text.length": 4,
        "content_type": "application/json",
        "speakers_count": 2,
    }


def test_the_content_denylist_is_case_insensitive(telemetry: Telemetry) -> None:
    get_logger("test").info("dictionary.searched", Character="知", TOPIC="food", Speakers=["小明"])

    assert _only(telemetry).log_record.attributes == {}


def test_the_content_denylist_holds_at_debug_level(telemetry: Telemetry) -> None:
    get_logger("test").debug("strokes.lookup_fetched", character="知", content="一段文字")

    record = _only(telemetry).log_record
    assert record.severity_text == "DEBUG"
    assert "character" not in record.attributes
    assert "content" not in record.attributes


def test_a_nested_content_key_is_dropped_too(telemetry: Telemetry) -> None:
    get_logger("test").info("reading.generated", details={"content": "一段文字", "count": 2})

    assert _only(telemetry).log_record.attributes == {"details": {"count": 2}}


def test_the_content_denylist_is_additive_to_the_secret_redaction(telemetry: Telemetry) -> None:
    get_logger("test").info("auth.failed", password="hunter2", query="知道", api_key="k-1")

    attributes = _only(telemetry).log_record.attributes
    assert attributes["password"] == "[REDACTED]"
    assert attributes["api_key"] == "[REDACTED]"
    assert "query" not in attributes


def test_the_console_renderer_never_sees_a_content_key(telemetry: Telemetry, capfd: pytest.CaptureFixture[str]) -> None:
    get_logger("test").info("dictionary.searched", query="知道", character="知", **{"reading.format": "dialogue"})

    output = capfd.readouterr().out
    payload = json.loads(output.strip().splitlines()[-1])
    assert "query" not in payload
    assert "character" not in payload
    assert "知道" not in output
    assert payload["reading.format"] == "dialogue"


def test_a_reserved_stdlib_key_is_namespaced_not_rejected(telemetry: Telemetry) -> None:
    get_logger("test").info("study.batch.imported", created=3)

    record = _only(telemetry).log_record
    assert record.attributes["event.created"] == 3
    assert "created" not in record.attributes


def test_the_console_rendering_carries_the_same_fields_and_redaction(
    telemetry: Telemetry, capfd: pytest.CaptureFixture[str]
) -> None:
    get_logger("test").info("auth.failed", password="hunter2", widget_count=3)

    payload = json.loads(capfd.readouterr().out.strip().splitlines()[-1])
    assert payload["body"] == "auth.failed"
    assert payload["event.name"] == "auth.failed"
    assert payload["severity_text"] == "INFO"
    assert payload["password"] == "[REDACTED]"
    assert payload["widget_count"] == 3
    assert payload["resource"] == {"service.name": "shougong"}


def test_exception_semconv_is_emitted(telemetry: Telemetry) -> None:
    try:
        raise RuntimeError("boom")
    except RuntimeError as error:
        get_logger("test").error("http.request.failed", exc_info=error)

    record = _only(telemetry).log_record
    assert record.severity_text == "ERROR"
    assert record.attributes["exception.type"] == "RuntimeError"
    assert record.attributes["exception.message"] == "boom"
    assert "RuntimeError" in record.attributes["exception.stacktrace"]


def test_uvicorn_loggers_are_re_parented_and_access_logs_are_off(telemetry: Telemetry) -> None:
    for name in ("uvicorn", "uvicorn.error"):
        logger = logging.getLogger(name)
        assert logger.handlers == []
        assert logger.propagate is True
    assert logging.getLogger("uvicorn.access").disabled is True
