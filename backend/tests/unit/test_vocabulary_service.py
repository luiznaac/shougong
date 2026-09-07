from __future__ import annotations

from collections.abc import Sequence

from shougong.usecase.dictionary.model import DictionaryEntry
from shougong.usecase.reading.vocabulary import VocabularyCategory
from shougong.usecase.reading.vocabulary_service import VocabularyOverviewService
from tests.fixtures import FakeDictionaryRepository, FakeStudyItemRepository, make_dictionary_entry, make_study_item

Word = tuple[str, int | None, tuple[str, ...]]


def _entries(words: Sequence[Word], start: int) -> list[DictionaryEntry]:
    return [
        make_dictionary_entry(
            entry_id=start + i, simplified=w, pinyin="x", definitions=("g",), hsk_level=level, pos_tags=tags
        )
        for i, (w, level, tags) in enumerate(words)
    ]


def _service(known: Sequence[Word], *, also_in_hsk: Sequence[Word] = ()) -> VocabularyOverviewService:
    studied = _entries(known, start=1)
    dictionary_only = _entries(also_in_hsk, start=1000)
    study = FakeStudyItemRepository([make_study_item(item_id=e.id, entry=e) for e in studied])
    return VocabularyOverviewService(study, FakeDictionaryRepository([*studied, *dictionary_only]))


async def test_list_derives_word_classes_and_carries_pinyin_and_gloss() -> None:
    study = FakeStudyItemRepository(
        [
            make_study_item(
                item_id=1,
                entry=make_dictionary_entry(
                    entry_id=1,
                    simplified="书",
                    pinyin="shu1",
                    definitions=("book", "letter"),
                    hsk_level=1,
                    pos_tags=("n",),
                ),
            )
        ]
    )
    service = VocabularyOverviewService(study, FakeDictionaryRepository())

    listed = await service.list()

    assert listed[0].simplified == "书"
    assert listed[0].pos_categories == frozenset({VocabularyCategory.NOUN})
    assert (listed[0].pinyin, listed[0].gloss) == ("shu1", "book; letter")


async def test_summary_counts_category_membership_and_flags_qualifier_shortage() -> None:
    service = _service([("好", 1, ("a",)), ("跑", 2, ("v",)), ("代表", 2, ("v", "n"))])

    summary = await service.summary()

    assert summary.total == 3
    assert summary.categorised == 3
    assert summary.by_category["verb"] == 2  # 跑 and 代表
    assert summary.by_category["noun"] == 1  # 代表 also lands here
    assert summary.by_category["qualifier"] == 1
    assert summary.qualifier_shortage is True  # only 1 adjective, floor is 5


async def test_summary_reports_hsk_proficiency_against_the_dictionary_totals() -> None:
    service = _service(
        [("好", 1, ("a",)), ("跑", 1, ("v",)), ("书", 2, ("n",))],
        also_in_hsk=[("的", 1, ("u",)), ("坏", 2, ("a",))] + [(f"w{i}", 2, ("n",)) for i in range(7)],
    )

    summary = await service.summary()

    # level 1: 2 known of 3 total (好 跑 + 的); level 2: 1 known of 9 total
    assert summary.proficiency.coverage_by_level == {1: 2 / 3, 2: 1 / 9}
    assert summary.proficiency.estimated_level == 1


async def test_summary_buckets_words_without_an_hsk_level_under_none() -> None:
    service = _service([("书", 1, ("n",)), ("叽", None, ())])

    summary = await service.summary()

    assert summary.by_hsk_level == {"1": 1, "none": 1}
    assert summary.categorised == 1


async def test_a_word_with_several_readings_is_one_word_here() -> None:
    walk = make_dictionary_entry(
        entry_id=1, simplified="行", pinyin="xing2", definitions=("to walk",), hsk_level=2, pos_tags=("v",)
    )
    firm = make_dictionary_entry(
        entry_id=2, simplified="行", pinyin="hang2", definitions=("firm",), hsk_level=2, pos_tags=("n",)
    )
    study = FakeStudyItemRepository([make_study_item(item_id=1, entry=walk), make_study_item(item_id=2, entry=firm)])
    service = VocabularyOverviewService(study, FakeDictionaryRepository([walk, firm]))

    assert len(await service.list()) == 1
    assert (await service.summary()).total == 1
