"""Outbound ports for the dictionary slice. Implemented in the adapters."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol

from shougong.usecase.dictionary.model import CedictRecord, DictionaryEntry


class IDictionaryRepository(Protocol):
    async def search(self, query: str, limit: int) -> list[DictionaryEntry]: ...

    async def find_by_simplified(self, simplified: str) -> list[DictionaryEntry]:
        """Every entry with exactly this simplified form (a hanzi can have several readings)."""
        ...

    async def get(self, entry_id: int) -> DictionaryEntry | None: ...

    async def count(self) -> int: ...

    async def bulk_add(self, records: Sequence[CedictRecord]) -> int: ...


class ICedictSource(Protocol):
    """Fetches the full CC-CEDICT dataset from its upstream (MDBG)."""

    async def fetch(self) -> list[CedictRecord]: ...
