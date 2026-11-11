from __future__ import annotations

import random
from datetime import UTC, datetime

from shougong.usecase.commons.time import FixedClock
from shougong.usecase.reading.model import (
    GeneratedReading,
    ReadingFormat,
    ReadingPunctuation,
    ReadingRequest,
    ReadingWord,
    SavedReadingText,
)
from shougong.usecase.reading.service import ReadingService
from tests.fixtures import (
    FakeDictionaryRepository,
    FakeReadingHistoryRepository,
    FakeReadingTextGateway,
    FakeReadingTopicRepository,
    FakeReadingWordUsageRepository,
    FakeSegmenter,
    FakeStudyItemRepository,
    make_dictionary_entry,
    make_study_item,
)

_NOW = datetime(2026, 1, 1, tzinfo=UTC)


def _service(
    *,
    dictionary: FakeDictionaryRepository,
    history: FakeReadingHistoryRepository,
    known: FakeStudyItemRepository | None = None,
) -> ReadingService:
    return ReadingService(
        FakeReadingTextGateway({}),
        FakeSegmenter({}),
        known or FakeStudyItemRepository([]),
        dictionary,
        history,
        FakeReadingWordUsageRepository(),
        FakeReadingTopicRepository(),
        FixedClock(_NOW),
        rng=random.Random(0),
    )


def _seed(history: FakeReadingHistoryRepository, *, text: str, created_at: datetime) -> None:
    reading = GeneratedReading(
        format=ReadingFormat.PARAGRAPH,
        tokens=(
            ReadingWord(
                text=text,
                pinyin=None,
                definitions=(),
                part_of_speech=None,
                is_extra=False,
                dictionary_entry_id=None,
            ),
            ReadingPunctuation(text="。"),
        ),
        known_word_count=0,
    )
    history.saved.append(
        SavedReadingText(
            id=len(history.saved) + 1,
            request=ReadingRequest(format=ReadingFormat.PARAGRAPH, max_extra_words=0, model="m"),
            reading=reading,
            created_at=created_at,
        )
    )


async def test_list_summaries_without_a_filter_leaves_match_null() -> None:
    history = FakeReadingHistoryRepository()
    dictionary = FakeDictionaryRepository([make_dictionary_entry(entry_id=1, simplified="知道")])
    _seed(history, text="知道", created_at=datetime(2026, 1, 1, tzinfo=UTC))
    service = _service(dictionary=dictionary, history=history)

    page = await service.list_summaries(limit=20, offset=0)

    assert page.total == 1
    assert page.items[0].match is None
    assert page.items[0].preview == "知道。"


async def test_list_summaries_by_entry_adds_the_match_snippet() -> None:
    entry = make_dictionary_entry(entry_id=7, simplified="知道")
    history = FakeReadingHistoryRepository()
    dictionary = FakeDictionaryRepository([entry])
    _seed(history, text="知道", created_at=datetime(2026, 1, 1, tzinfo=UTC))
    service = _service(dictionary=dictionary, history=history)

    page = await service.list_summaries(limit=20, offset=0, entry_id=7)

    assert page.total == 1
    assert page.items[0].match is not None
    assert page.items[0].match.hit == "知道"
    assert page.items[0].match.after == "。"


async def test_list_summaries_by_unknown_entry_is_an_empty_page() -> None:
    history = FakeReadingHistoryRepository()
    dictionary = FakeDictionaryRepository([])
    service = _service(dictionary=dictionary, history=history)

    page = await service.list_summaries(limit=8, offset=4, entry_id=999)

    assert page.items == ()
    assert page.total == 0
    assert (page.limit, page.offset) == (8, 4)


async def test_list_summaries_by_entry_prefers_the_studied_reading_of_a_word() -> None:
    studied = make_dictionary_entry(entry_id=2, simplified="好", pinyin="hao3")
    other_reading = make_dictionary_entry(entry_id=1, simplified="好", pinyin="hao4")
    history = FakeReadingHistoryRepository()
    _seed(history, text="好", created_at=datetime(2026, 1, 1, tzinfo=UTC))
    service = _service(
        dictionary=FakeDictionaryRepository([other_reading, studied]),
        history=history,
        known=FakeStudyItemRepository([make_study_item(item_id=1, entry=studied)]),
    )

    by_studied = await service.list_summaries(limit=20, offset=0, entry_id=2)
    by_alternative = await service.list_summaries(limit=20, offset=0, entry_id=1)

    assert by_studied.total == 1
    assert by_studied.items[0].match is not None
    # The alternate reading of the same hanzi is never the resolved entry.
    assert by_alternative.items == ()
    assert by_alternative.total == 0


async def test_list_summaries_by_entry_falls_back_to_the_first_candidate_by_id() -> None:
    first = make_dictionary_entry(entry_id=1, simplified="好", pinyin="hao3")
    second = make_dictionary_entry(entry_id=2, simplified="好", pinyin="hao4")
    history = FakeReadingHistoryRepository()
    _seed(history, text="好", created_at=datetime(2026, 1, 1, tzinfo=UTC))
    service = _service(dictionary=FakeDictionaryRepository([first, second]), history=history)

    assert (await service.list_summaries(limit=20, offset=0, entry_id=1)).total == 1
    assert (await service.list_summaries(limit=20, offset=0, entry_id=2)).total == 0
