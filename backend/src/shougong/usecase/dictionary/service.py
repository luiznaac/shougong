"""`DictionaryService` — search/lookup plus CC-CEDICT (re)population."""

from __future__ import annotations

from collections import Counter

from shougong.usecase.commons.exceptions import ResourceNotFoundError
from shougong.usecase.commons.page import Page
from shougong.usecase.dictionary.gateway import (
    CommunityPosTags,
    EnrichmentDataset,
    ICedictSource,
    IDictionaryRepository,
    IHskCharacterSource,
    IHskDatasetSource,
    IOfficialHskSource,
    OfficialLevels,
)
from shougong.usecase.dictionary.import_policy import apply_import_policy, select_cleanup_ids
from shougong.usecase.dictionary.model import (
    DictionaryEntry,
    DictionaryWordGroup,
    HskDatasetWord,
    RelatedEntryPage,
    derive_handwriting_level,
)
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

    async def search(self, query: str, limit: int = 20, offset: int = 0) -> Page[DictionaryWordGroup]:
        """One page of matches, one item per `(simplified, pinyin)` group.

        Args:
            query: The trimmed hanzi or numbered-pinyin substring.
            limit: Page size, in groups.
            offset: Groups to skip.

        Returns:
            One page of word groups plus the exact total of matching groups.
        """
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

        Idempotent: once loaded, every later call is a no-op. The set-level import
        policy trims alias and duplicate rows before they reach the table. Runs
        from the startup hook in the composition root.
        """
        existing = await self._repository.count()
        if existing > 0:
            self._telemetry.record_populate_skipped(existing=existing)
            return 0

        records = await source.fetch()
        self._telemetry.record_source_downloaded("cedict", len(records))
        added = await self._repository.bulk_add(apply_import_policy(records))
        self._telemetry.record_populated(records=added)
        return added

    async def enrich_hsk(
        self,
        official: IOfficialHskSource,
        community: IHskDatasetSource,
        character_source: IHskCharacterSource,
    ) -> int:
        """Stamp the official vocabulary level, community POS tags and handwriting levels.

        The vocabulary level comes from the official HSK 3.0 word list (1-6, or 7
        for the 7-9 band); the community dataset supplies only the POS tags the
        reading engine samples from. A word outside the official list ends with no
        level, so advancing the pass also clears stale levels. The character
        writing levels come from the official handwriting list and are stored per
        character; each word's `handwriting_level` is derived as the max writing
        level among its characters that have one.

        Versioned and idempotent: the pass persists the enrichment version it ran
        and skips once the stored version matches the code's. Advancing the
        version re-runs it, first cleaning the alias and exact-duplicate rows a
        pre-policy import left behind, then updating existing rows in place so row
        ids and study items/history survive. Runs from the startup hook, after the
        dictionary is populated.
        """
        stored = await self._repository.enrichment_version()
        if stored == self.enrichment_version:
            self._telemetry.record_hsk_enrich_skipped(version=stored)
            return 0

        # An empty table means the CC-CEDICT pass has not filled it yet. Leave
        # the marker unset so the enrichment runs once there is data to stamp.
        if await self._repository.count() == 0:
            return 0

        levels = await official.fetch()
        self._telemetry.record_source_downloaded("official-hsk", len(levels))
        community_pos = await community.fetch()
        self._telemetry.record_source_downloaded("community-hsk", len(community_pos))
        # An empty word source is a failed download, not a version worth
        # recording — leave the marker unset so the next boot retries.
        if not levels or not community_pos:
            return 0

        characters = await character_source.fetch()
        self._telemetry.record_source_downloaded("hsk_characters", len(characters))
        # Same rule for the character list: an empty download is not a version.
        if not characters:
            return 0

        await self._clean_import_noise()
        applied = await self._repository.apply_enrichment(_combined(levels, community_pos))
        character_levels = {character: entry.writing_level for character, entry in characters.items()}
        await self._repository.apply_character_levels(character_levels)
        forms = await self._repository.simplified_forms()
        await self._repository.set_handwriting_levels(
            {entry_id: derive_handwriting_level(simplified, character_levels) for entry_id, simplified in forms}
        )
        await self._repository.set_enrichment_version(self.enrichment_version, Counter(levels.values()))
        self._telemetry.record_hsk_enriched(records=applied)
        return applied

    async def _clean_import_noise(self) -> None:
        """Remove the alias and exact-duplicate rows a pre-policy import left behind.

        Re-derives the import policy over the stored rows and deletes what it would
        have dropped on a fresh import, so an old database converges on the same
        rows without a reload. Rows a study item or its history references are kept,
        so no learner's queue breaks. Runs inside the versioned enrichment pass.
        """
        entries = await self._repository.list_all()
        protected = await self._repository.protected_entry_ids()
        to_delete = select_cleanup_ids(entries, protected)
        if not to_delete:
            return
        removed = await self._repository.delete_entries(sorted(to_delete))
        self._telemetry.record_import_cleaned(removed=removed)


def _combined(levels: OfficialLevels, community_pos: CommunityPosTags) -> EnrichmentDataset:
    """Join the official levels to the community POS tags by simplified form.

    A word present in only one source still gets an entry: its missing side is
    cleared (`None` level, empty tags) by the repository's clear-then-stamp.
    """
    combined = {word: HskDatasetWord(word, level, ()) for word, level in levels.items()}
    for word, pos_tags in community_pos.items():
        existing = combined.get(word)
        combined[word] = HskDatasetWord(
            word,
            existing.hsk_level if existing is not None else None,
            pos_tags,
        )
    return combined
