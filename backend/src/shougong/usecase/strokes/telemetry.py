"""Strokes instruments and the warm-failure record — the OTel API half of the strokes slice.

The lookup path is metric-only: a positive cache hit, a fetch-and-cache and a
miss each increment exactly one counter and emit no log. Only a background warm
failure is a record, and it carries ids and exception shape — never the
character.
"""

from __future__ import annotations

from opentelemetry.metrics import Meter

from shougong.usecase.commons.logging import get_logger


class StrokesTelemetry:
    def __init__(self, meter: Meter) -> None:
        self._log = get_logger(__name__)
        self._lookup_hit = meter.create_counter(
            "strokes.lookup_hit",
            unit="{lookup}",
            description="A stroke lookup served from a positive cached row.",
        )
        self._lookup_fetched = meter.create_counter(
            "strokes.lookup_fetched",
            unit="{lookup}",
            description="A stroke lookup whose fetch-and-cache returned data.",
        )
        self._lookup_missed = meter.create_counter(
            "strokes.lookup_missed",
            unit="{lookup}",
            description="A stroke lookup that found no drawable data.",
        )

    def lookup_hit(self) -> None:
        self._lookup_hit.add(1)

    def lookup_fetched(self) -> None:
        self._lookup_fetched.add(1)

    def lookup_missed(self) -> None:
        self._lookup_missed.add(1)

    def warm_failed(self, error: BaseException) -> None:
        self._log.error("strokes.warm_failed", exc_info=error)
