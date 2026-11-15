"""Contract tests for the reading slice's signals — learner content stays out."""

from __future__ import annotations

import random
from collections.abc import Iterator

import pytest

from shougong.application.telemetry import Telemetry, build_telemetry
from shougong.usecase.commons.logging import configure_logging
from shougong.usecase.commons.time import FixedClock
from shougong.usecase.reading.gateway import SegmentedToken
from shougong.usecase.reading.model import PartOfSpeech, ReadingFormat, ReadingRequest
from shougong.usecase.reading.service import ReadingService
from tests.fixtures import (
    FakeDictionaryRepository,
    FakeReadingHistoryRepository,
    FakeReadingTextGateway,
    FakeReadingTopicRepository,
    FakeReadingWordUsageRepository,
    FakeSegmenter,
    FakeStudyItemRepository,
    build_test_settings,
    log_records,
    make_dictionary_entry,
    make_segmented_token,
    make_study_item,
)


@pytest.fixture
def telemetry() -> Iterator[Telemetry]:
    instance = build_telemetry(build_test_settings())
    configure_logging("INFO", json=True)
    instance.install_log_bridge()
    try:
        yield instance
    finally:
        instance.shutdown()


def _tok(text: str, pos: PartOfSpeech | None = PartOfSpeech.NOUN) -> SegmentedToken:
    return make_segmented_token(text, part_of_speech=pos)


async def test_a_dialogue_generation_emits_no_log_record(telemetry: Telemetry) -> None:
    ge = make_dictionary_entry(entry_id=1, simplified="哥哥", pinyin="ge1 ge5", definitions=("older brother",))
    mei = make_dictionary_entry(entry_id=2, simplified="妹妹", pinyin="mei4 mei5", definitions=("younger sister",))
    hao = make_dictionary_entry(entry_id=3, simplified="好", pinyin="hao3", definitions=("good",))
    service = ReadingService(
        FakeReadingTextGateway(
            {
                "text": "好。好。",
                "lines": [{"speaker": "哥哥", "text": "好。"}, {"speaker": "妹妹", "text": "好。"}],
            }
        ),
        FakeSegmenter(
            {
                "好。好。": (_tok("好"), _tok("。", None), _tok("好"), _tok("。", None)),
                "好。": (_tok("好"), _tok("。", None)),
            }
        ),
        FakeStudyItemRepository([make_study_item(item_id=i, entry=e) for i, e in enumerate((ge, mei, hao), 1)]),
        FakeDictionaryRepository(),
        FakeReadingHistoryRepository(),
        FakeReadingWordUsageRepository(),
        FakeReadingTopicRepository(),
        FixedClock(make_study_item().created_at),
        rng=random.Random(0),
    )

    await service.generate(ReadingRequest(format=ReadingFormat.DIALOGUE, max_extra_words=0, model="test-model"))

    assert log_records(telemetry) == []
