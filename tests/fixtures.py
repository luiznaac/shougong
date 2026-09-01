"""Shared test builders and in-memory fakes.

Import from here instead of hand-rolling doubles in each test.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable, Sequence
from itertools import count
from typing import TypeVar

from shougong.usecase.dictionary.model import CedictRecord, DictionaryEntry

_T = TypeVar("_T")


def make_dictionary_entry(
    *,
    entry_id: int = 1,
    simplified: str = "学",
    pinyin: str = "xue2",
    definitions: tuple[str, ...] = ("to learn", "to study"),
) -> DictionaryEntry:
    return DictionaryEntry(id=entry_id, simplified=simplified, pinyin=pinyin, definitions=definitions)


class FakeTransactionTemplate:
    """Runs the block straight through — no real transaction."""

    async def execute(self, block: Callable[[], Awaitable[_T]]) -> _T:
        return await block()


class FakeDictionaryRepository:
    def __init__(self, entries: list[DictionaryEntry] | None = None) -> None:
        self.entries: list[DictionaryEntry] = list(entries or [])
        self._ids = count(1)

    async def search(self, query: str, limit: int) -> list[DictionaryEntry]:
        matches = [e for e in self.entries if query in e.simplified or query in e.pinyin]
        return matches[:limit]

    async def get(self, entry_id: int) -> DictionaryEntry | None:
        return next((e for e in self.entries if e.id == entry_id), None)

    async def count(self) -> int:
        return len(self.entries)

    async def bulk_add(self, records: Sequence[CedictRecord]) -> int:
        for record in records:
            self.entries.append(
                DictionaryEntry(
                    id=next(self._ids),
                    simplified=record.simplified,
                    pinyin=record.pinyin,
                    definitions=record.definitions,
                )
            )
        return len(records)


class FakeCedictSource:
    def __init__(self, records: list[CedictRecord] | None = None) -> None:
        self.records: list[CedictRecord] = list(records or [])
        self.fetch_calls = 0

    async def fetch(self) -> list[CedictRecord]:
        self.fetch_calls += 1
        return list(self.records)
