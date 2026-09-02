"""Shared test builders and in-memory fakes.

Import from here instead of hand-rolling doubles in each test.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable, Sequence
from datetime import UTC, datetime, timedelta
from itertools import count
from typing import TypeVar

from shougong.usecase.configuration.transaction import ITransactionTemplate
from shougong.usecase.dictionary.gateway import ICedictSource, IDictionaryRepository
from shougong.usecase.dictionary.model import CedictRecord, DictionaryEntry
from shougong.usecase.srs.engine import ISrsEngine
from shougong.usecase.srs.model import SrsCard, SrsRating, SrsReviewLog, SrsState
from shougong.usecase.study.gateway import IStudyItemRepository
from shougong.usecase.study.model import StudyItem, StudyItemHistory

_T = TypeVar("_T")

_EPOCH = datetime(2026, 1, 1, tzinfo=UTC)


def make_dictionary_entry(
    *,
    entry_id: int = 1,
    simplified: str = "学",
    pinyin: str = "xue2",
    definitions: tuple[str, ...] = ("to learn", "to study"),
) -> DictionaryEntry:
    return DictionaryEntry(id=entry_id, simplified=simplified, pinyin=pinyin, definitions=definitions)


def make_srs_card(*, due: datetime = _EPOCH) -> SrsCard:
    return SrsCard(state=SrsState.LEARNING, stability=None, difficulty=None, due=due, last_review=None)


def make_study_item(
    *,
    item_id: int = 1,
    entry: DictionaryEntry | None = None,
    card: SrsCard | None = None,
    created_at: datetime = _EPOCH,
) -> StudyItem:
    return StudyItem(
        id=item_id,
        entry=entry or make_dictionary_entry(),
        card=card or make_srs_card(),
        created_at=created_at,
    )


class FakeTransactionTemplate(ITransactionTemplate):
    """Runs the block straight through — no real transaction."""

    async def execute(self, block: Callable[[], Awaitable[_T]]) -> _T:
        return await block()


class FakeDictionaryRepository(IDictionaryRepository):
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


class FakeCedictSource(ICedictSource):
    def __init__(self, records: list[CedictRecord] | None = None) -> None:
        self.records: list[CedictRecord] = list(records or [])
        self.fetch_calls = 0

    async def fetch(self) -> list[CedictRecord]:
        self.fetch_calls += 1
        return list(self.records)


class StubSrsEngine(ISrsEngine):
    """Deterministic engine: new cards are due `now`, a review pushes due out a day."""

    def new_card(self, now: datetime) -> SrsCard:
        return make_srs_card(due=now)

    def review(self, card: SrsCard, rating: SrsRating, now: datetime) -> tuple[SrsCard, SrsReviewLog]:
        next_card = SrsCard(
            state=SrsState.REVIEW,
            stability=1.0,
            difficulty=5.0,
            due=now + timedelta(days=1),
            last_review=now,
        )
        return next_card, SrsReviewLog(rating=rating, review_datetime=now)


class FakeStudyItemRepository(IStudyItemRepository):
    def __init__(self, items: list[StudyItem] | None = None) -> None:
        self.items: list[StudyItem] = list(items or [])
        self.review_logs: dict[int, list[SrsReviewLog]] = {}
        self.history: dict[int, list[StudyItemHistory]] = {}
        self._ids = count(1)

    def _record_history(self, item: StudyItem, created_at: datetime) -> None:
        self.history.setdefault(item.id, []).append(
            StudyItemHistory(
                study_item_id=item.id,
                entry=item.entry,
                card=item.card,
                created_at=created_at,
            )
        )

    async def create(self, entry: DictionaryEntry, card: SrsCard, created_at: datetime) -> StudyItem:
        item = StudyItem(id=next(self._ids), entry=entry, card=card, created_at=created_at)
        self.items.append(item)
        self._record_history(item, created_at)
        return item

    async def get(self, item_id: int) -> StudyItem | None:
        return next((i for i in self.items if i.id == item_id), None)

    async def exists_for_entry(self, entry_id: int) -> bool:
        return any(i.entry.id == entry_id for i in self.items)

    async def list(self, *, due_before: datetime | None, limit: int, offset: int) -> list[StudyItem]:
        rows = sorted(self.items, key=lambda i: (i.card.due, i.id))
        if due_before is not None:
            rows = [i for i in rows if i.card.due <= due_before]
        return rows[offset : offset + limit]

    async def update_card(self, item_id: int, card: SrsCard, changed_at: datetime) -> StudyItem:
        for index, item in enumerate(self.items):
            if item.id == item_id:
                updated = StudyItem(id=item.id, entry=item.entry, card=card, created_at=item.created_at)
                self.items[index] = updated
                self._record_history(updated, changed_at)
                return updated
        raise KeyError(item_id)

    async def add_review_log(self, item_id: int, log: SrsReviewLog) -> None:
        self.review_logs.setdefault(item_id, []).append(log)

    async def list_reviews(self, item_id: int, *, limit: int, offset: int) -> list[SrsReviewLog]:
        logs = self.review_logs.get(item_id, [])
        # newest first; ties broken by later insertion first, mirroring the repo's id DESC
        order = sorted(range(len(logs)), key=lambda i: (logs[i].review_datetime, i), reverse=True)
        return [logs[i] for i in order][offset : offset + limit]

    async def list_history(self, item_id: int, *, limit: int, offset: int) -> list[StudyItemHistory]:
        rows = self.history.get(item_id, [])
        # newest first; ties broken by later insertion first, mirroring the repo's created_at/id DESC
        order = sorted(range(len(rows)), key=lambda i: (rows[i].created_at, i), reverse=True)
        return [rows[i] for i in order][offset : offset + limit]
