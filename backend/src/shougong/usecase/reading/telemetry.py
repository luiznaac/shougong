"""Reading/AI instruments and curated events — the OTel API half of the reading slice.

The collaborator owns the slice's product instruments, the verbatim GenAI
inference counters/histogram and the curated WARN. It performs no I/O: the
service hands it the facts it already observed. The composition root builds it
with the process meter and calls `record_jieba_warmup_failure` from the task
boundary that owns that failure.
"""

from __future__ import annotations

from opentelemetry.metrics import Meter

from shougong.usecase.commons.logging import get_logger
from shougong.usecase.reading.model import ReadingFormat

_CORRECTION_ATTEMPT_BUCKETS = (1, 2, 3, 4, 5, 6)
_EXTRA_WORD_BUCKETS = (0, 1, 2, 3, 5, 8, 13, 21)

_GENAI_OPERATION = "chat"
_GENAI_PROVIDER = "litellm"
_GENAI_TOKEN_MODALITY = "text"


def _genai_attributes(model: str) -> dict[str, str]:
    return {
        "gen_ai.operation.name": _GENAI_OPERATION,
        "gen_ai.provider.name": _GENAI_PROVIDER,
        "gen_ai.request.model": model,
    }


class ReadingTelemetry:
    def __init__(self, meter: Meter) -> None:
        self._log = get_logger(__name__)
        self._generated = meter.create_counter(
            "reading.generated",
            unit="{reading}",
            description="The number of reading texts generated and saved.",
        )
        self._generation_failed = meter.create_counter(
            "reading.generation_failed",
            unit="{reading}",
            description="The number of reading generations that ended in a bounded failure.",
        )
        self._correction_attempts = meter.create_histogram(
            "reading.correction_attempts",
            unit="{attempt}",
            description="The number of model attempts a saved reading needed.",
            explicit_bucket_boundaries_advisory=_CORRECTION_ATTEMPT_BUCKETS,
        )
        self._extra_words = meter.create_histogram(
            "reading.extra_words",
            unit="{word}",
            description="The out-of-vocabulary word count of the chosen draft.",
            explicit_bucket_boundaries_advisory=_EXTRA_WORD_BUCKETS,
        )
        self._budget_exceeded = meter.create_counter(
            "reading.budget_exceeded",
            unit="{reading}",
            description="The number of saved readings whose chosen draft still exceeds the budget.",
        )
        self._input_tokens = meter.create_counter(
            "gen_ai.client.inference.usage.input_tokens",
            unit="{token}",
            description="The number of input tokens a successful inference attempt consumed.",
        )
        self._output_tokens = meter.create_counter(
            "gen_ai.client.inference.usage.output_tokens",
            unit="{token}",
            description="The number of output tokens a successful inference attempt produced.",
        )
        self._duration = meter.create_histogram(
            "gen_ai.client.inference.duration",
            unit="s",
            description="The wall-clock duration of one inference attempt, failures included.",
        )

    def record_generated(
        self,
        *,
        reading_format: ReadingFormat,
        model: str,
        corrected: bool,
        attempts: int,
        extra_words: int,
        budget_exceeded: bool,
    ) -> None:
        attributes = {"reading.format": reading_format.value}
        self._generated.add(
            1,
            {**attributes, "gen_ai.request.model": model, "reading.corrected": "true" if corrected else "false"},
        )
        self._correction_attempts.record(attempts, attributes)
        self._extra_words.record(extra_words, attributes)
        if budget_exceeded:
            self._budget_exceeded.add(1, attributes)

    def record_generation_failed(self, *, reading_format: ReadingFormat, model: str, error_type: str) -> None:
        self._generation_failed.add(
            1,
            {"reading.format": reading_format.value, "gen_ai.request.model": model, "error.type": error_type},
        )

    def record_attempt_succeeded(self, *, model: str, input_tokens: int, output_tokens: int, duration: float) -> None:
        token_attributes = {**_genai_attributes(model), "gen_ai.token.modality": _GENAI_TOKEN_MODALITY}
        self._input_tokens.add(input_tokens, token_attributes)
        self._output_tokens.add(output_tokens, token_attributes)
        self._duration.record(duration, _genai_attributes(model))

    def record_attempt_failed(self, *, model: str, error_type: str, duration: float) -> None:
        self._duration.record(duration, {**_genai_attributes(model), "error.type": error_type})

    def record_generation_degraded(
        self, *, reading_format: ReadingFormat, attempts: int, extra_words: int, problems: int
    ) -> None:
        self._log.warning(
            "reading.generation_degraded",
            **{
                "reading.format": reading_format.value,
                "reading.attempts": attempts,
                "reading.extra_words": extra_words,
                "reading.problems": problems,
            },
        )

    def record_jieba_warmup_failure(self, error: Exception) -> None:
        self._log.error("reading.jieba_warmup_failed", exc_info=error)
