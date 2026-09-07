"""Outbound ports for the dictionary slice. Implemented in the adapters."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Protocol

from shougong.usecase.dictionary.model import CedictRecord, DictionaryEntry, HskDatasetWord


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
