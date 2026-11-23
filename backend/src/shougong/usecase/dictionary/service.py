"""`DictionaryService` — search/lookup plus CC-CEDICT (re)population."""

from __future__ import annotations

from shougong.usecase.commons.exceptions import ResourceNotFoundError
from shougong.usecase.commons.page import Page
from shougong.usecase.dictionary.gateway import (
    ICedictSource,
    IDictionaryRepository,
    IHskCharacterSource,
    IHskDatasetSource,
)
from shougong.usecase.dictionary.model import DictionaryEntry, RelatedEntryPage, derive_handwriting_level
from shougong.usecase.dictionary.telemetry import DictionaryTelemetry


class DictionaryService:
    def __init__(
        self,
        repository: IDictionaryRepository,
        telemetry: DictionaryTelemetry,
        *,
        enrichment_version: int,
    ) -> None:
        self._repository = repository
        self._telemetry = telemetry
        self.enrichment_version = enrichment_version

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

    async def enrich_hsk(self, source: IHskDatasetSource, character_source: IHskCharacterSource) -> int:
        """Stamp the vocabulary level and POS tags, then derive the handwriting levels.

        The vocabulary level and POS tags come from the word dataset; the
        character writing levels come from the official handwriting list and are
        stored per character. Each word's `handwriting_level` is derived as the
        max writing level among its characters that have one.

        Versioned and idempotent: the pass persists the enrichment version it ran
        and skips once the stored version matches the code's. Advancing the
        version re-runs it, updating existing rows in place so row ids and study
        history survive. Runs from the startup hook, after the dictionary is
        populated.
        """
        stored = await self._repository.enrichment_version()
        if stored == self.enrichment_version:
            self._telemetry.record_hsk_enrich_skipped(version=stored)
            return 0

        # An empty table means the CC-CEDICT pass has not filled it yet. Leave
        # the marker unset so the enrichment runs once there is data to stamp.
        if await self._repository.count() == 0:
            return 0

        dataset = await source.fetch()
        self._telemetry.record_source_downloaded("hsk", len(dataset))
        # An empty dataset is a failed download, not a version worth recording —
        # leave the marker unset so the next boot retries.
        if not dataset:
            return 0

        characters = await character_source.fetch()
        self._telemetry.record_source_downloaded("hsk_characters", len(characters))
        # Same rule for the character list: an empty download is not a version.
        if not characters:
            return 0

        applied = await self._repository.apply_hsk(dataset)
        character_levels = {character: entry.writing_level for character, entry in characters.items()}
        await self._repository.apply_character_levels(character_levels)
        forms = await self._repository.simplified_forms()
        await self._repository.set_handwriting_levels(
            {entry_id: derive_handwriting_level(simplified, character_levels) for entry_id, simplified in forms}
        )
        await self._repository.set_enrichment_version(self.enrichment_version)
        self._telemetry.record_hsk_enriched(records=applied)
        return applied
