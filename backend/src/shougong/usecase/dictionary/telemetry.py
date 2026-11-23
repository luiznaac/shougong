"""Dictionary instruments and curated events — the OTel API half of the slice.

The collaborator owns the search and bootstrap instruments plus the INFO/ERROR
events the dictionary bootstrap emits. It performs no I/O; callers hand it the
fact they already observed.
"""

from __future__ import annotations

from typing import Literal

from opentelemetry.metrics import Meter

from shougong.usecase.commons.logging import get_logger

type AutoloadStage = Literal["populate", "enrich"]
type DictionarySource = Literal["cedict", "official-hsk", "community-hsk"]


class DictionaryTelemetry:
    def __init__(self, meter: Meter) -> None:
        self._log = get_logger(__name__)
        self._autoload_failures = meter.create_counter(
            "dictionary.autoload_failed",
            unit="{failure}",
            description="The number of failed dictionary bootstrap stages.",
        )
        self._searches = meter.create_counter(
            "dictionary.searched",
            unit="{search}",
            description="The number of dictionary searches split by hit or miss.",
        )

    def record_search(self, *, hit: bool) -> None:
        self._searches.add(1, {"result": "hit" if hit else "miss"})

    def record_autoload_failed(self, stage: AutoloadStage, error: BaseException) -> None:
        self._autoload_failures.add(1, {"dictionary.stage": stage})
        self._log.error(
            "dictionary.autoload_failed",
            exc_info=(type(error), error, error.__traceback__),
            **{"dictionary.stage": stage},
        )

    def record_source_downloaded(self, source: DictionarySource, records: int) -> None:
        self._log.info(
            "dictionary.source_downloaded",
            **{"dictionary.source": source, "dictionary.records": records},
        )

    def record_populated(self, records: int) -> None:
        self._log.info("dictionary.populated", **{"dictionary.records": records})

    def record_populate_skipped(self, existing: int) -> None:
        self._log.info("dictionary.populate_skipped", **{"dictionary.existing": existing})

    def record_hsk_enriched(self, records: int) -> None:
        self._log.info("dictionary.hsk_enriched", **{"dictionary.records": records})

    def record_hsk_enrich_skipped(self, version: int) -> None:
        self._log.info("dictionary.hsk_enrich_skipped", **{"dictionary.enrichment_version": version})
