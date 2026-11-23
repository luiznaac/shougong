"""Outbound ports for the dictionary slice. Implemented in the adapters."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Protocol

from shougong.usecase.commons.page import Page
from shougong.usecase.dictionary.model import (
    CedictRecord,
    DictionaryEntry,
    HskCharacter,
    HskDatasetWord,
    RelatedEntryPage,
)

# Official HSK 3.0 word → its vocabulary level (1-6, or 7 for the 7-9 band).
type OfficialLevels = dict[str, int]
# Community HSK word → its ICTCLAS POS tags.
type CommunityPosTags = dict[str, tuple[str, ...]]
# A word → the level and POS tags the enrichment pass stamps onto it.
type EnrichmentDataset = dict[str, HskDatasetWord]


class IDictionaryRepository(Protocol):
    async def search(self, query: str, *, limit: int, offset: int) -> Page[DictionaryEntry]:
        """One page of the substring matches, plus the exact total of all matches."""
        ...

    async def find_by_simplified(self, simplified: str) -> list[DictionaryEntry]:
        """Every entry with exactly this simplified form (a hanzi can have several readings)."""
        ...

    async def find_by_simplified_many(self, simplified_words: Sequence[str]) -> list[DictionaryEntry]:
        """Every entry whose simplified form is in `simplified_words` (each word
        can have several readings), in one round trip."""
        ...

    async def get(self, entry_id: int) -> DictionaryEntry | None: ...

    async def find_related(self, target: DictionaryEntry, *, limit: int, offset: int) -> RelatedEntryPage:
        """One page of the target's shared-character family, plus the family's total.

        An entry is related when its `simplified` shares at least one hanzi with
        `target.simplified`, excluding the target itself and every entry with the
        same `simplified` (alternate readings of the same word are not related
        words). Ordered by distinct shared hanzi DESC, `hsk_level` ASC NULLS
        LAST, `char_length(simplified)` ASC, `id` ASC.

        Args:
            target: The entry whose shared-character family is listed.
            limit: Page size.
            offset: Rows to skip.

        Returns:
            One page of related rows, plus the family's total size.
        """
        ...

    async def count(self) -> int: ...

    async def bulk_add(self, records: Sequence[CedictRecord]) -> int: ...

    async def apply_enrichment(self, dataset: EnrichmentDataset) -> int:
        """Replace every entry's `hsk_level` and `pos_tags` with the enrichment
        values: clear both columns, then stamp each entry whose simplified form is
        a key of `dataset` — the same values on every row that shares it. A word
        absent from `dataset` therefore ends with no level and no tags. Returns
        the number of dataset words applied."""
        ...

    async def enrichment_version(self) -> int | None:
        """The enrichment version the dictionary was last enriched with, or `None`
        when the pass has never run."""
        ...

    async def official_level_totals(self) -> dict[int, int] | None:
        """The official per-level word counts recorded by the last pass, or `None`
        when no pass has recorded them."""
        ...

    async def set_enrichment_version(self, version: int, level_totals: Mapping[int, int]) -> None:
        """Persist `version` and the official per-level `level_totals` as the single
        enrichment marker."""
        ...

    async def hsk_words(self) -> list[HskDatasetWord]:
        """One `HskDatasetWord` per distinct simplified form that has an
        `hsk_level`, for the per-level functional-word sets."""
        ...

    async def apply_character_levels(self, levels: Mapping[str, int]) -> int:
        """Upsert the character-level writing store from `levels` (character →
        writing level). Returns the number of characters applied."""
        ...

    async def simplified_forms(self) -> list[tuple[int, str]]:
        """Every dictionary entry's `(id, simplified)`, for the handwriting rollup."""
        ...

    async def set_handwriting_levels(self, levels: Mapping[int, int | None]) -> int:
        """Set `handwriting_level` on each listed entry id — an explicit `None`
        clears it. Returns the number of rows written."""
        ...


class ICedictSource(Protocol):
    """Fetches the full CC-CEDICT dataset from its upstream (MDBG)."""

    async def fetch(self) -> list[CedictRecord]: ...


class IOfficialHskSource(Protocol):
    """Fetches the official HSK 3.0 word list (the vocabulary-level source)."""

    async def fetch(self) -> OfficialLevels:
        """Every listed word → its official vocabulary level, keyed by simplified
        form. Levels are 1-6, plus 7 for the single 7-9 band."""
        ...


class IHskDatasetSource(Protocol):
    """Fetches the community HSK dataset (the POS-tag source)."""

    async def fetch(self) -> CommunityPosTags:
        """Every listed word → its POS tags, keyed by simplified form."""
        ...


class IHskCharacterSource(Protocol):
    """Fetches the official HSK 3.0 handwriting character list from its upstream."""

    async def fetch(self) -> dict[str, HskCharacter]:
        """Every listed character → its writing level, keyed by character."""
        ...
