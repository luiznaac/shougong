"""`DictionaryService` — search/lookup plus CC-CEDICT (re)population."""

from __future__ import annotations

from shougong.usecase.commons.exceptions import ResourceNotFoundError
from shougong.usecase.commons.page import Page
from shougong.usecase.dictionary.gateway import ICedictSource, IDictionaryRepository, IHskDatasetSource
from shougong.usecase.dictionary.model import DictionaryEntry, RelatedEntryPage
from shougong.usecase.dictionary.telemetry import DictionaryTelemetry


class DictionaryService:
    def __init__(self, repository: IDictionaryRepository, telemetry: DictionaryTelemetry) -> None:
        self._repository = repository
        self._telemetry = telemetry

    async def search(self, query: str, limit: int = 20, offset: int = 0) -> Page[DictionaryEntry]:
        page = await self._repository.search(query.strip(), limit=limit, offset=offset)
        self._telemetry.record_search(hit=page.total > 0)
        return page

    async def get(self, entry_id: int) -> DictionaryEntry:
        entry = await self._repository.get(entry_id)
        if entry is None:
            raise ResourceNotFoundError("dictionary_entry", str(entry_id))
        return entry

    async def related(self, entry_id: int, *, limit: int = 20, offset: int = 0) -> RelatedEntryPage:
        """One page of the entry's shared-character family, plus the family's total.

        Args:
            entry_id: The target entry id.
            limit: Page size.
            offset: Rows to skip.

        Returns:
            One page of related rows, plus the family's total size.

        Raises:
            ResourceNotFoundError: no entry has this id.
        """
        target = await self.get(entry_id)
        return await self._repository.find_related(target, limit=limit, offset=offset)

    async def populate_if_empty(self, source: ICedictSource) -> int:
        """Download CC-CEDICT and fill the table, but only if it is empty.

        Idempotent: once loaded, every later call is a no-op. Runs from the
        startup hook in the composition root.
        """
        existing = await self._repository.count()
        if existing > 0:
            self._telemetry.record_populate_skipped(existing=existing)
            return 0

        records = await source.fetch()
        self._telemetry.record_source_downloaded("cedict", len(records))
        added = await self._repository.bulk_add(records)
        self._telemetry.record_populated(records=added)
        return added

    async def enrich_hsk(self, source: IHskDatasetSource) -> int:
        """Stamp `hsk_level` and `pos_tags` onto the dictionary from the HSK dataset.

        Idempotent: once any entry carries an `hsk_level`, every later call is a
        no-op. Runs from the startup hook, after the dictionary is populated.
        """
        existing = await self._repository.count_with_hsk()
        if existing > 0:
            self._telemetry.record_hsk_enrich_skipped(existing=existing)
            return 0

        dataset = await source.fetch()
        self._telemetry.record_source_downloaded("hsk", len(dataset))
        applied = await self._repository.apply_hsk(dataset)
        self._telemetry.record_hsk_enriched(records=applied)
        return applied
