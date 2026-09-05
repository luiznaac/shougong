from __future__ import annotations

from shougong.usecase.commons.time import FixedClock
from shougong.usecase.reading.gateway import SegmentedToken
from shougong.usecase.reading.model import ReadingFormat, ReadingPunctuation, ReadingRequest, ReadingWord
from shougong.usecase.reading.service import ReadingService
from shougong.usecase.study.model import StudyItem
from tests.fixtures import (
    FakeDictionaryRepository,
    FakeReadingHistoryRepository,
    FakeReadingTextGateway,
    FakeSegmenter,
    FakeStudyItemRepository,
    make_dictionary_entry,
    make_segmented_token,
    make_srs_card,
    make_study_item,
)

_NOW = make_srs_card().due  # 2026-01-01T00:00:00Z


def _service(
    *,
    response: str,
    segments: dict[str, tuple[SegmentedToken, ...]],
    known: list[StudyItem] | None = None,
    dictionary: FakeDictionaryRepository | None = None,
    history: FakeReadingHistoryRepository | None = None,
) -> tuple[ReadingService, FakeReadingTextGateway, FakeReadingHistoryRepository]:
    gateway = FakeReadingTextGateway(response)
    segmenter = FakeSegmenter(segments)
    study = FakeStudyItemRepository(known or [])
    history = history or FakeReadingHistoryRepository()
    service = ReadingService(
        gateway,
        segmenter,
        study,
        dictionary or FakeDictionaryRepository(),
        history,
        FixedClock(_NOW),
    )
    return service, gateway, history


def _tok(text: str, pos: str | None = "n") -> SegmentedToken:
    return make_segmented_token(text, pos_tag=pos)


async def test_generate_calls_the_gateway_exactly_once() -> None:
    wo = make_dictionary_entry(entry_id=1, simplified="我", pinyin="wo3", definitions=("I; me",))
    shi = make_dictionary_entry(entry_id=2, simplified="是", pinyin="shi4", definitions=("to be",))
    xue_sheng = make_dictionary_entry(entry_id=3, simplified="学生", pinyin="xue2 sheng5", definitions=("student",))
    known = [
        make_study_item(item_id=1, entry=wo),
        make_study_item(item_id=2, entry=shi),
        make_study_item(item_id=3, entry=xue_sheng),
    ]

    service, gateway, history = _service(
        response="我是学生。",
        segments={
            "我是学生。": (_tok("我", "r"), _tok("是", "v"), _tok("学生", "n"), _tok("。", None)),
        },
        known=known,
    )

    saved = await service.generate(ReadingRequest(format=ReadingFormat.SENTENCES, max_extra_words=0))

    assert len(gateway.calls) == 1
    assert saved.reading.extra_word_count == 0
    assert saved.reading.extra_char_count == 0
    assert saved.reading.known_word_count == 3
    assert saved.reading.known_words_char_count == len("我") + len("是") + len("学生")
    words = [t for t in saved.reading.tokens if isinstance(t, ReadingWord)]
    assert all(not w.is_extra for w in words)
    assert any(isinstance(t, ReadingPunctuation) for t in saved.reading.tokens)
    assert history.saved == [saved]


async def test_extras_over_budget_are_reported_not_retried() -> None:
    wo = make_dictionary_entry(entry_id=1, simplified="我", pinyin="wo3", definitions=("I; me",))
    shi = make_dictionary_entry(entry_id=2, simplified="是", pinyin="shi4", definitions=("to be",))
    known = [make_study_item(item_id=1, entry=wo), make_study_item(item_id=2, entry=shi)]

    service, gateway, _ = _service(
        response="我是猫。",
        segments={"我是猫。": (_tok("我", "r"), _tok("是", "v"), _tok("猫", "n"), _tok("。", None))},
        known=known,
    )

    saved = await service.generate(ReadingRequest(format=ReadingFormat.SENTENCES, max_extra_words=0))

    assert len(gateway.calls) == 1  # exceeding the budget never triggers a second call
    assert saved.reading.extra_word_count == 1
    assert saved.reading.extra_char_count == len("猫")
    extra_words = [t.text for t in saved.reading.tokens if isinstance(t, ReadingWord) and t.is_extra]
    assert extra_words == ["猫"]


async def test_a_word_with_no_dictionary_entry_at_all_resolves_with_no_pinyin() -> None:
    wo = make_dictionary_entry(entry_id=1, simplified="我", pinyin="wo3", definitions=("I; me",))
    known = [make_study_item(item_id=1, entry=wo)]

    service, _, _ = _service(
        response="我叽。",
        segments={"我叽。": (_tok("我", "r"), _tok("叽", "n"), _tok("。", None))},
        known=known,
        dictionary=FakeDictionaryRepository(),  # empty — "叽" has no entry anywhere
    )

    saved = await service.generate(ReadingRequest(format=ReadingFormat.PARAGRAPH, max_extra_words=5))

    extra = next(t for t in saved.reading.tokens if isinstance(t, ReadingWord) and t.text == "叽")
    assert extra.is_extra is True
    assert extra.pinyin is None
    assert extra.definitions == ()
    assert extra.dictionary_entry_id is None


async def test_a_repeated_known_word_is_resolved_using_the_studied_entry_not_another_reading() -> None:
    # "行" has two readings in the dictionary; the learner specifically studied
    # the "xing2" (to walk/OK) one, not "hang2" (firm/row) — resolution must
    # prefer the studied entry over whatever find_by_simplified returns first.
    other_reading = make_dictionary_entry(entry_id=1, simplified="行", pinyin="hang2", definitions=("firm; row",))
    studied = make_dictionary_entry(entry_id=2, simplified="行", pinyin="xing2", definitions=("to walk; OK",))
    known = [make_study_item(item_id=1, entry=studied)]

    service, _, _ = _service(
        response="行行。",
        segments={"行行。": (_tok("行", "v"), _tok("行", "v"), _tok("。", None))},
        known=known,
        dictionary=FakeDictionaryRepository([other_reading, studied]),
    )

    saved = await service.generate(ReadingRequest(format=ReadingFormat.PARAGRAPH, max_extra_words=5))

    words = [t for t in saved.reading.tokens if isinstance(t, ReadingWord)]
    assert len(words) == 2  # both occurrences resolved
    assert all(w.pinyin == "xing2" and not w.is_extra for w in words)
    assert all(w.dictionary_entry_id == studied.id for w in words)  # the studied entry, not the other reading


async def test_list_history_delegates_to_the_repository() -> None:
    history = FakeReadingHistoryRepository()
    entry = make_dictionary_entry(entry_id=1, simplified="我")
    service, _, _ = _service(
        response="我。",
        segments={"我。": (_tok("我", "r"), _tok("。", None))},
        known=[make_study_item(item_id=1, entry=entry)],
        history=history,
    )
    await service.generate(ReadingRequest(format=ReadingFormat.PARAGRAPH, max_extra_words=5))

    listed = await service.list_history(limit=10, offset=0)

    assert listed == history.saved
