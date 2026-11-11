"""Outbound ports for the dictionary slice. Implemented in the adapters."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Protocol

from shougong.usecase.dictionary.model import (
    CedictRecord,
    DictionaryEntry,
    HskDatasetWord,
    RelatedEntryPage,
)


class IDictionaryRepository(Protocol):
    async def search(self, query: str, limit: int) -> list[DictionaryEntry]: ...

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

    async def apply_hsk(self, dataset: Mapping[str, HskDatasetWord]) -> int:
        """Stamp `hsk_level` and `pos_tags` onto every entry whose simplified form
        is a key of `dataset` — the same values on every row that shares it.
        Returns the number of dataset words applied."""
        ...

    async def count_with_hsk(self) -> int:
        """How many entries already carry an `hsk_level` — the enrichment gate."""
        ...

    async def hsk_words(self) -> list[HskDatasetWord]:
        """One `HskDatasetWord` per distinct simplified form that has an
        `hsk_level`, for the per-level statistics."""
        ...


class ICedictSource(Protocol):
    """Fetches the full CC-CEDICT dataset from its upstream (MDBG)."""

    async def fetch(self) -> list[CedictRecord]: ...


class IHskDatasetSource(Protocol):
    """Fetches the HSK word list from its upstream (a community dataset)."""

    async def fetch(self) -> dict[str, HskDatasetWord]:
        """Every listed word → its level and POS tags, keyed by simplified form."""
        ...
