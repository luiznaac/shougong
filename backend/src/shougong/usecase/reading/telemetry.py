"""Reading-slice telemetry — the OTel API half of the reading slice.

The collaborator owns the slice's curated events (and, as the reading metrics
land, its instruments). The composition root builds it with the process meter
and calls it from the task boundary that owns a failure.
"""

from __future__ import annotations

from opentelemetry.metrics import Meter

from shougong.usecase.commons.logging import get_logger


class ReadingTelemetry:
    def __init__(self, meter: Meter) -> None:
        self._meter = meter
        self._log = get_logger(__name__)

    def record_jieba_warmup_failure(self, error: Exception) -> None:
        self._log.error("reading.jieba_warmup_failed", exc_info=error)
