"""Shared test builders and in-memory fakes.

Import from here instead of hand-rolling doubles in each test.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable, Sequence
from datetime import UTC, datetime, timedelta
from itertools import count, pairwise
from typing import TypeVar

from shougong.usecase.configuration.transaction import ITransactionTemplate
from shougong.usecase.dictionary.gateway import ICedictSource, IDictionaryRepository
from shougong.usecase.dictionary.model import CedictRecord, DictionaryEntry
from shougong.usecase.reading.gateway import (
    IHskVocabularySource,
    IReadingHistoryRepository,
    IReadingTextGateway,
    ISegmenter,
    IVocabularyProfileRepository,
    ReadingDraft,
    RejectedDraft,
    SegmentedToken,
)
from shougong.usecase.reading.model import (
    GeneratedReading,
    PartOfSpeech,
    ReadingFormat,
    ReadingRequest,
    SavedReadingText,
)
from shougong.usecase.reading.vocabulary import HskEntry, VocabularyProfile
from shougong.usecase.srs.engine import ISrsEngine
from shougong.usecase.srs.model import SrsCard, SrsRating, SrsReviewLog, SrsState
from shougong.usecase.strokes.gateway import IHanziStrokeSource, IStrokeRepository
from shougong.usecase.strokes.model import CharacterStrokes, StrokeLookupResult
from shougong.usecase.study.gateway import IStudyItemRepository
from shougong.usecase.study.model import StudyItem
from shougong.usecase.study_item_history.gateway import IStudyItemHistoryRepository
from shougong.usecase.study_item_history.model import StudyItemHistory

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

    async def find_by_simplified(self, simplified: str) -> list[DictionaryEntry]:
        return sorted((e for e in self.entries if e.simplified == simplified), key=lambda e: e.id)

    async def find_by_simplified_many(self, simplified_words: Sequence[str]) -> list[DictionaryEntry]:
        wanted = set(simplified_words)
        return sorted((e for e in self.entries if e.simplified in wanted), key=lambda e: e.id)

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


def make_character_strokes(
    *,
    character: str = "学",
    strokes: tuple[str, ...] = ("M 1 1 L 2 2",),
    medians: tuple[tuple[tuple[float, float], ...], ...] = (((1.0, 1.0), (2.0, 2.0)),),
) -> CharacterStrokes:
    return CharacterStrokes(character=character, strokes=strokes, medians=medians)


class FakeStrokeRepository(IStrokeRepository):
    def __init__(self) -> None:
        self.rows: dict[str, StrokeLookupResult] = {}

    async def find(self, character: str) -> StrokeLookupResult | None:
        return self.rows.get(character)

    async def save(self, character: str, strokes: CharacterStrokes | None) -> None:
        self.rows[character] = StrokeLookupResult(character=character, strokes=strokes)


class FakeHanziStrokeSource(IHanziStrokeSource):
    def __init__(self, data: dict[str, CharacterStrokes | None] | None = None) -> None:
        self.data: dict[str, CharacterStrokes | None] = dict(data or {})
        self.fetch_calls = 0

    async def fetch(self, character: str) -> CharacterStrokes | None:
        self.fetch_calls += 1
        return self.data.get(character)


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


class FakeStudyItemHistoryRepository(IStudyItemHistoryRepository):
    def __init__(self) -> None:
        self.rows: list[StudyItemHistory] = []  # every recorded snapshot, in write order

    async def record(self, item: StudyItem, recorded_at: datetime) -> None:
        self.rows.append(
            StudyItemHistory(
                study_item_id=item.id,
                entry=item.entry,
                card=item.card,
                created_at=recorded_at,
            )
        )

    def _newest_first(self, rows: list[StudyItemHistory]) -> list[StudyItemHistory]:
        # ties broken by later write first, mirroring the repo's created_at/id DESC
        write_order = {id(row): i for i, row in enumerate(self.rows)}
        return sorted(rows, key=lambda r: (r.created_at, write_order[id(r)]), reverse=True)

    async def list_for_item(self, item_id: int, *, limit: int, offset: int) -> list[StudyItemHistory]:
        rows = self._newest_first([r for r in self.rows if r.study_item_id == item_id])
        return rows[offset : offset + limit]

    async def list_learning_to_review_transitions(self, *, limit: int, offset: int) -> list[StudyItemHistory]:
        by_item: dict[int, list[StudyItemHistory]] = {}
        for row in self.rows:
            by_item.setdefault(row.study_item_id, []).append(row)
        transitions: list[StudyItemHistory] = []
        for trail in by_item.values():
            for previous, current in pairwise(trail):  # rows are in write == trail order
                if previous.card.state is SrsState.LEARNING and current.card.state is SrsState.REVIEW:
                    transitions.append(current)
        return self._newest_first(transitions)[offset : offset + limit]


class FakeStudyItemRepository(IStudyItemRepository):
    def __init__(
        self,
        items: list[StudyItem] | None = None,
        *,
        history: FakeStudyItemHistoryRepository | None = None,
    ) -> None:
        self.items: list[StudyItem] = list(items or [])
        self.review_logs: dict[int, list[SrsReviewLog]] = {}
        self.history = history or FakeStudyItemHistoryRepository()
        self._ids = count(1)

    async def create(self, entry: DictionaryEntry, card: SrsCard, created_at: datetime) -> StudyItem:
        item = StudyItem(id=next(self._ids), entry=entry, card=card, created_at=created_at)
        self.items.append(item)
        await self.history.record(item, created_at)
        return item

    async def get(self, item_id: int) -> StudyItem | None:
        return next((i for i in self.items if i.id == item_id), None)

    async def exists_for_entry(self, entry_id: int) -> bool:
        return any(i.entry.id == entry_id for i in self.items)

    async def list_known_entries(self) -> list[DictionaryEntry]:
        return [item.entry for item in self.items]

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
                await self.history.record(updated, changed_at)
                return updated
        raise KeyError(item_id)

    async def add_review_log(self, item_id: int, log: SrsReviewLog) -> None:
        self.review_logs.setdefault(item_id, []).append(log)

    async def list_reviews(self, item_id: int, *, limit: int, offset: int) -> list[SrsReviewLog]:
        logs = self.review_logs.get(item_id, [])
        # newest first; ties broken by later insertion first, mirroring the repo's id DESC
        order = sorted(range(len(logs)), key=lambda i: (logs[i].review_datetime, i), reverse=True)
        return [logs[i] for i in order][offset : offset + limit]


class FakeReadingTextGateway(IReadingTextGateway):
    """Returns a canned text; records what it was called with (a single shot,
    never retried)."""

    def __init__(self, response: str | Sequence[str], *, tokens_per_call: int = 100) -> None:
        # One string → returned every call; a sequence → one per call, last repeats.
        self._responses = [response] if isinstance(response, str) else list(response)
        self._tokens_per_call = tokens_per_call
        self.calls: list[dict[str, object]] = []
        self.models: tuple[str, ...] = ("fake-model",)

    async def list_models(self) -> tuple[str, ...]:
        return self.models

    async def generate(
        self,
        *,
        known_words: frozenset[str],
        text_format: ReadingFormat,
        max_extra_words: int,
        model: str,
        topic: str | None,
        prior_attempts: Sequence[RejectedDraft] = (),
    ) -> ReadingDraft:
        self.calls.append(
            {
                "known_words": known_words,
                "text_format": text_format,
                "max_extra_words": max_extra_words,
                "model": model,
                "topic": topic,
                "prior_attempts": tuple(prior_attempts),
            }
        )
        text = self._responses[min(len(self.calls) - 1, len(self._responses) - 1)]
        return ReadingDraft(text=text, prompt_tokens=self._tokens_per_call, completion_tokens=self._tokens_per_call)


def make_segmented_token(text: str, *, part_of_speech: PartOfSpeech | None = PartOfSpeech.NOUN) -> SegmentedToken:
    return SegmentedToken(text=text, part_of_speech=part_of_speech)


class FakeSegmenter(ISegmenter):
    """Maps exact input text to a canned token tuple set up by the test —
    decoupled from real jieba behaviour."""

    def __init__(self, mapping: dict[str, tuple[SegmentedToken, ...]]) -> None:
        self.mapping: dict[str, tuple[SegmentedToken, ...]] = dict(mapping)

    def segment(self, text: str) -> tuple[SegmentedToken, ...]:
        return self.mapping[text]


class FakeReadingHistoryRepository(IReadingHistoryRepository):
    def __init__(self) -> None:
        self.saved: list[SavedReadingText] = []
        self._ids = count(1)

    async def save(self, request: ReadingRequest, reading: GeneratedReading, created_at: datetime) -> SavedReadingText:
        saved = SavedReadingText(id=next(self._ids), request=request, reading=reading, created_at=created_at)
        self.saved.append(saved)
        return saved

    async def list(self, *, limit: int, offset: int) -> list[SavedReadingText]:
        newest_first = sorted(self.saved, key=lambda s: s.id, reverse=True)
        return newest_first[offset : offset + limit]


class FakeHskVocabularySource(IHskVocabularySource):
    def __init__(self, entries: dict[str, HskEntry] | None = None) -> None:
        self.entries: dict[str, HskEntry] = dict(entries or {})
        self.fetch_calls = 0

    async def fetch(self) -> dict[str, HskEntry]:
        self.fetch_calls += 1
        return dict(self.entries)


class FakeVocabularyProfileRepository(IVocabularyProfileRepository):
    def __init__(self, profiles: list[VocabularyProfile] | None = None) -> None:
        self.profiles: dict[str, VocabularyProfile] = {p.simplified: p for p in (profiles or [])}

    async def list_all(self) -> list[VocabularyProfile]:
        return [self.profiles[k] for k in sorted(self.profiles)]

    async def upsert_many(self, profiles: Sequence[VocabularyProfile], updated_at: datetime) -> None:
        for profile in profiles:
            self.profiles[profile.simplified] = profile

    async def get(self, simplified: str) -> VocabularyProfile | None:
        return self.profiles.get(simplified)
