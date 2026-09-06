from __future__ import annotations

from collections.abc import Sequence

from shougong.usecase.commons.time import FixedClock
from shougong.usecase.reading.gateway import SegmentedToken
from shougong.usecase.reading.model import (
    GeneratedReading,
    PartOfSpeech,
    ReadingFormat,
    ReadingPunctuation,
    ReadingRequest,
    ReadingWord,
    SavedReadingText,
)
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
    response: str | Sequence[str],
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


def _tok(text: str, pos: PartOfSpeech | None = PartOfSpeech.NOUN) -> SegmentedToken:
    return make_segmented_token(text, part_of_speech=pos)


def _req(fmt: ReadingFormat, max_extra_words: int, *, model: str = "test-model") -> ReadingRequest:
    return ReadingRequest(format=fmt, max_extra_words=max_extra_words, model=model)


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
            "我是学生。": (
                _tok("我", PartOfSpeech.PRONOUN),
                _tok("是", PartOfSpeech.VERB),
                _tok("学生", PartOfSpeech.NOUN),
                _tok("。", None),
            ),
        },
        known=known,
    )

    saved = await service.generate(_req(ReadingFormat.SENTENCES, 0, model="haiku-x"))

    assert len(gateway.calls) == 1
    assert gateway.calls[0]["model"] == "haiku-x"  # the caller's model choice reaches the gateway
    assert gateway.calls[0]["prior_attempts"] == ()  # first shot, nothing to revise
    assert saved.request.model == "haiku-x"  # and is persisted with the reading
    assert saved.reading.known_word_count == 3
    assert saved.reading.attempt_count == 1
    assert [a.chosen for a in saved.reading.attempts] == [True]
    words = [t for t in saved.reading.tokens if isinstance(t, ReadingWord)]
    assert all(not w.is_extra for w in words)
    assert any(isinstance(t, ReadingPunctuation) for t in saved.reading.tokens)
    assert history.saved == [saved]


async def test_extras_over_budget_trigger_a_rewrite() -> None:
    wo = make_dictionary_entry(entry_id=1, simplified="我", pinyin="wo3", definitions=("I; me",))
    shi = make_dictionary_entry(entry_id=2, simplified="是", pinyin="shi4", definitions=("to be",))
    known = [make_study_item(item_id=1, entry=wo), make_study_item(item_id=2, entry=shi)]

    service, gateway, _ = _service(
        response=["我是猫。", "我是我。"],  # first draft has an out-of-vocabulary word, the rewrite doesn't
        segments={
            "我是猫。": (_tok("我", PartOfSpeech.PRONOUN), _tok("是", PartOfSpeech.VERB), _tok("猫"), _tok("。", None)),
            "我是我。": (_tok("我", PartOfSpeech.PRONOUN), _tok("是", PartOfSpeech.VERB), _tok("我"), _tok("。", None)),
        },
        known=known,
    )

    saved = await service.generate(_req(ReadingFormat.SENTENCES, 0))

    assert len(gateway.calls) == 2
    prior = gateway.calls[1]["prior_attempts"]
    assert [d.rejected_words for d in prior] == [("猫",)]  # the exact violation is handed back
    assert saved.reading.attempt_count == 2
    assert [a.chosen for a in saved.reading.attempts] == [False, True]
    assert saved.reading.extra_words == ()  # the chosen draft is clean
    assert not any(isinstance(t, ReadingWord) and t.is_extra for t in saved.reading.tokens)


async def test_gives_up_after_max_attempts_keeps_the_cleanest_draft() -> None:
    wo = make_dictionary_entry(entry_id=1, simplified="我", pinyin="wo3", definitions=("I; me",))
    known = [make_study_item(item_id=1, entry=wo)]

    service, gateway, _ = _service(
        response=["猫猫猫。", "我猫。", "我猫猫。"],  # 1 distinct extra / 1 / 1 — none within budget 0
        segments={
            "猫猫猫。": (_tok("猫"), _tok("猫"), _tok("猫"), _tok("。", None)),
            "我猫。": (_tok("我", PartOfSpeech.PRONOUN), _tok("猫"), _tok("。", None)),
            "我猫猫。": (_tok("我", PartOfSpeech.PRONOUN), _tok("猫"), _tok("猫"), _tok("。", None)),
        },
        known=known,
    )

    saved = await service.generate(_req(ReadingFormat.SENTENCES, 0))

    assert len(gateway.calls) == 3
    assert saved.reading.attempt_count == 3
    chosen = next(a for a in saved.reading.attempts if a.chosen)
    assert chosen.text == "我猫猫。"  # fewest extras (tie on 1), most recent wins
    assert saved.reading.extra_words == ("猫",)


async def test_attempt_trail_records_segmentation_and_token_usage() -> None:
    wo = make_dictionary_entry(entry_id=1, simplified="我", pinyin="wo3", definitions=("I; me",))
    known = [make_study_item(item_id=1, entry=wo)]

    service, _, _ = _service(
        response=["我猫。", "我我。"],
        segments={
            "我猫。": (_tok("我", PartOfSpeech.PRONOUN), _tok("猫"), _tok("。", None)),
            "我我。": (_tok("我", PartOfSpeech.PRONOUN), _tok("我"), _tok("。", None)),
        },
        known=known,
    )

    saved = await service.generate(_req(ReadingFormat.SENTENCES, 0))

    first = saved.reading.attempts[0]
    assert first.segmentation == ("我", "猫", "。")  # the segmenter's raw tokens, punctuation included
    assert first.extra_words == ("猫",)
    assert saved.reading.prompt_tokens == 200  # 100 per call, summed over 2 attempts
    assert saved.reading.completion_tokens == 200


async def test_a_word_with_no_dictionary_entry_at_all_resolves_with_no_pinyin() -> None:
    wo = make_dictionary_entry(entry_id=1, simplified="我", pinyin="wo3", definitions=("I; me",))
    known = [make_study_item(item_id=1, entry=wo)]

    service, _, _ = _service(
        response="我叽。",
        segments={"我叽。": (_tok("我", PartOfSpeech.PRONOUN), _tok("叽", PartOfSpeech.NOUN), _tok("。", None))},
        known=known,
        dictionary=FakeDictionaryRepository(),  # empty — "叽" has no entry anywhere
    )

    saved = await service.generate(_req(ReadingFormat.PARAGRAPH, 5))

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
        segments={"行行。": (_tok("行", PartOfSpeech.VERB), _tok("行", PartOfSpeech.VERB), _tok("。", None))},
        known=known,
        dictionary=FakeDictionaryRepository([other_reading, studied]),
    )

    saved = await service.generate(_req(ReadingFormat.PARAGRAPH, 5))

    words = [t for t in saved.reading.tokens if isinstance(t, ReadingWord)]
    assert len(words) == 2  # both occurrences resolved
    assert all(w.pinyin == "xing2" and not w.is_extra for w in words)
    assert all(w.dictionary_entry_id == studied.id for w in words)  # the studied entry, not the other reading


async def test_list_models_delegates_to_the_gateway() -> None:
    service, gateway, _ = _service(response="unused", segments={})
    gateway.models = ("claude-haiku-4-5", "claude-sonnet-4-5")

    assert await service.list_models() == ("claude-haiku-4-5", "claude-sonnet-4-5")


async def test_list_history_delegates_to_the_repository() -> None:
    history = FakeReadingHistoryRepository()
    entry = make_dictionary_entry(entry_id=1, simplified="我", pinyin="wo3", definitions=("I; me",))
    service, _, _ = _service(
        response="我。",
        segments={"我。": (_tok("我", PartOfSpeech.PRONOUN), _tok("。", None))},
        known=[make_study_item(item_id=1, entry=entry)],
        dictionary=FakeDictionaryRepository([entry]),
        history=history,
    )
    await service.generate(_req(ReadingFormat.PARAGRAPH, 5))

    listed = await service.list_history(limit=10, offset=0)

    assert listed == history.saved


async def test_list_history_hydrates_pinyin_and_definitions_from_the_dictionary() -> None:
    # Simulates a row that already round-tripped through the DB: pinyin,
    # definitions, and the dictionary id are never stored, so a freshly-read
    # row always has them blank until the service re-resolves them by word
    # text via find_by_simplified_many.
    entry = make_dictionary_entry(entry_id=7, simplified="水果", pinyin="shui3 guo3", definitions=("fruit",))
    stripped_word = ReadingWord(
        text="水果",
        pinyin=None,
        definitions=(),
        part_of_speech=PartOfSpeech.NOUN,
        is_extra=False,
        dictionary_entry_id=None,
    )
    history = FakeReadingHistoryRepository()
    history.saved.append(
        SavedReadingText(
            id=1,
            request=ReadingRequest(format=ReadingFormat.PARAGRAPH, max_extra_words=0, model="test-model"),
            reading=GeneratedReading(format=ReadingFormat.PARAGRAPH, tokens=(stripped_word,), known_word_count=1),
            created_at=_NOW,
        )
    )

    service, _, _ = _service(
        response="unused",
        segments={},
        dictionary=FakeDictionaryRepository([entry]),
        history=history,
    )

    listed = await service.list_history(limit=10, offset=0)

    hydrated = listed[0].reading.tokens[0]
    assert isinstance(hydrated, ReadingWord)
    assert hydrated.pinyin == "shui3 guo3"
    assert hydrated.definitions == ("fruit",)
    assert hydrated.dictionary_entry_id == 7  # recovered by word text, not by a stored id
