"""Study instruments and curated events — the OTel API half of the study slice.

The learning/SRS and engagement instruments fire at the usecase boundary that
performs the action. Only item additions, session opens and batch imports keep an
INFO record; the review hot path is metric-only, and identifiers stay in logs.
"""

from __future__ import annotations

from opentelemetry.metrics import Meter

from shougong.usecase.commons.logging import get_logger
from shougong.usecase.srs.model import SrsRating, SrsState
from shougong.usecase.study.model import ImportSkipReason, ItemSource, SessionKind

_REVIEW_LAG_BUCKETS = (300, 3600, 21600, 86400, 259200, 604800, 2592000)
_SESSION_SIZE_BUCKETS = (0, 1, 5, 10, 20, 40, 80, 160)


class StudyTelemetry:
    def __init__(self, meter: Meter) -> None:
        self._log = get_logger(__name__)
        self._item_added = meter.create_counter(
            "study.item_added",
            unit="{item}",
            description="The number of study items added, by intake source.",
        )
        self._item_reviewed = meter.create_counter(
            "study.item_reviewed",
            unit="{review}",
            description="The number of study item reviews, by rating and pre-review state.",
        )
        self._item_graduated = meter.create_counter(
            "study.item_graduated",
            unit="{item}",
            description="The number of study items graduating from learning to review.",
        )
        self._review_lag = meter.create_histogram(
            "study.review_lag",
            unit="s",
            description="The time between a card's due instant and its review.",
            explicit_bucket_boundaries_advisory=_REVIEW_LAG_BUCKETS,
        )
        self._session_created = meter.create_counter(
            "study.session_created",
            unit="{session}",
            description="The number of lesson or review sessions opened.",
        )
        self._session_size = meter.create_histogram(
            "study.session_size",
            unit="{item}",
            description="The number of items in an opened session.",
            explicit_bucket_boundaries_advisory=_SESSION_SIZE_BUCKETS,
        )
        self._batch_imported = meter.create_counter(
            "study.batch_imported",
            unit="{batch}",
            description="The number of batch import actions.",
        )
        self._import_row_skipped = meter.create_counter(
            "study.import_row_skipped",
            unit="{row}",
            description="The number of batch import rows that produced no item, by reason.",
        )

    def item_added(self, *, item_id: int, entry_id: int, source: ItemSource) -> None:
        self._item_added.add(1, {"source": source.value})
        self._log.info("study.item_added", item_id=item_id, entry_id=entry_id)

    def item_reviewed(self, *, rating: SrsRating, state: SrsState) -> None:
        self._item_reviewed.add(1, {"rating": rating.name.lower(), "srs.state": state.name.lower()})

    def item_graduated(self) -> None:
        self._item_graduated.add(1)

    def review_lag(self, seconds: float) -> None:
        self._review_lag.record(seconds)

    def session_created(self, *, kind: SessionKind, size: int) -> None:
        self._session_created.add(1, {"kind": kind.value})
        self._session_size.record(size, {"kind": kind.value})
        self._log.info("study.session_created", kind=kind.value)

    def batch_imported(self) -> None:
        self._batch_imported.add(1)
        self._log.info("study.batch_imported")

    def import_row_skipped(self, *, reason: ImportSkipReason) -> None:
        self._import_row_skipped.add(1, {"reason": reason.value})
