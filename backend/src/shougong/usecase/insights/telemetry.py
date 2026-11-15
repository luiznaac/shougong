"""Insights gauges — the library's state, recorded on the reads that compute it.

Every gauge is created once here; a read stores its snapshot and the callback
only replays it, so no gauge performs I/O and no poller exists. The snapshot
freezes while nobody reads the dashboard — a stale reading, never a wrong one.
"""

from __future__ import annotations

from collections.abc import Mapping

from opentelemetry.metrics import CallbackOptions, Meter, Observation


class InsightsTelemetry:
    def __init__(self, meter: Meter) -> None:
        self._stages: dict[str, int] = {}
        self._difficulty: dict[str, int] = {}
        self._due_items: dict[str, int] = {}
        self._forecast: dict[int, int] = {}
        self._leeches: int | None = None
        self._known_words: int | None = None

        self._items = meter.create_observable_gauge(
            "study.items",
            callbacks=[self._observe_items],
            unit="{item}",
            description="The last observed FSRS stability distribution of the library.",
        )
        self._difficulty_gauge = meter.create_observable_gauge(
            "study.item_difficulty",
            callbacks=[self._observe_difficulty],
            unit="{item}",
            description="The last observed FSRS difficulty bands of the library.",
        )
        self._due = meter.create_observable_gauge(
            "study.due_items",
            callbacks=[self._observe_due_items],
            unit="{item}",
            description="The last observed due queue depth by SRS state.",
        )
        self._forecast_gauge = meter.create_observable_gauge(
            "study.due_forecast",
            callbacks=[self._observe_forecast],
            unit="{item}",
            description="The last observed due load over the next seven days.",
        )
        self._leeches_gauge = meter.create_observable_gauge(
            "study.leeches",
            callbacks=[self._observe_leeches],
            unit="{item}",
            description="The last observed number of leeches.",
        )
        self._known_words_gauge = meter.create_observable_gauge(
            "vocabulary.known_words",
            callbacks=[self._observe_known_words],
            unit="{word}",
            description="The last observed number of known words.",
        )

    def record_overview(
        self,
        *,
        stages: Mapping[str, int],
        difficulty: Mapping[str, int],
        due_items: Mapping[str, int],
        forecast: Mapping[int, int],
        leeches: int,
    ) -> None:
        self._stages = dict(stages)
        self._difficulty = dict(difficulty)
        self._due_items = dict(due_items)
        self._forecast = dict(forecast)
        self._leeches = leeches

    def record_known_words(self, count: int) -> None:
        self._known_words = count

    def _observe_items(self, _: CallbackOptions) -> list[Observation]:
        return [Observation(value, {"srs.stage": stage}) for stage, value in self._stages.items()]

    def _observe_difficulty(self, _: CallbackOptions) -> list[Observation]:
        return [Observation(value, {"srs.difficulty": band}) for band, value in self._difficulty.items()]

    def _observe_due_items(self, _: CallbackOptions) -> list[Observation]:
        return [Observation(value, {"srs.state": state}) for state, value in self._due_items.items()]

    def _observe_forecast(self, _: CallbackOptions) -> list[Observation]:
        return [Observation(value, {"srs.horizon": str(horizon)}) for horizon, value in self._forecast.items()]

    def _observe_leeches(self, _: CallbackOptions) -> list[Observation]:
        if self._leeches is None:
            return []
        return [Observation(self._leeches)]

    def _observe_known_words(self, _: CallbackOptions) -> list[Observation]:
        if self._known_words is None:
            return []
        return [Observation(self._known_words)]
