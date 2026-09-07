from __future__ import annotations

from shougong.usecase.commons.time import FixedClock
from shougong.usecase.reading.proficiency import HskLevelStats
from shougong.usecase.reading.vocabulary import (
    HskEntry,
    ProfileSource,
    VocabularyCategory,
    VocabularyProfile,
)
from shougong.usecase.reading.vocabulary_service import VocabularyProfileService
from tests.fixtures import (
    FakeDictionaryRepository,
    FakeHskVocabularySource,
    FakeStudyItemRepository,
    FakeVocabularyProfileRepository,
    make_dictionary_entry,
    make_srs_card,
    make_study_item,
)

_NOW = make_srs_card().due


def _service(
    *,
    known: list[str],
    hsk: dict[str, HskEntry] | None = None,
    profiles: list[VocabularyProfile] | None = None,
    dictionary: FakeDictionaryRepository | None = None,
    stats: HskLevelStats | None = None,
) -> tuple[VocabularyProfileService, FakeVocabularyProfileRepository]:
    entries = [
        make_dictionary_entry(entry_id=i, simplified=w, pinyin="x", definitions=("g",)) for i, w in enumerate(known, 1)
    ]
    study = FakeStudyItemRepository([make_study_item(item_id=e.id, entry=e) for e in entries])
    profile_repo = FakeVocabularyProfileRepository(profiles)
    service = VocabularyProfileService(
        study,
        dictionary or FakeDictionaryRepository(entries),
        FakeHskVocabularySource(hsk or {}, stats=stats),
        profile_repo,
        FixedClock(_NOW),
    )
    return service, profile_repo


async def test_sync_resolves_from_hsk_and_marks_missing_words_unknown() -> None:
    service, repo = _service(
        known=["学生", "叽"],
        hsk={"学生": HskEntry(hsk_level=1, pos_tags=("n",))},
    )

    await service.sync()

    student = repo.profiles["学生"]
    assert (student.hsk_level, student.pos_category, student.source) == (1, VocabularyCategory.NOUN, ProfileSource.HSK)
    ji = repo.profiles["叽"]
    assert (ji.hsk_level, ji.source) == (None, ProfileSource.UNKNOWN)


async def test_sync_never_overwrites_a_manual_override() -> None:
    manual = VocabularyProfile(
        simplified="学生",
        hsk_level=9,
        pos_tags=(),
        pos_category=VocabularyCategory.PERSON,
        source=ProfileSource.MANUAL,
    )
    service, repo = _service(
        known=["学生"],
        hsk={"学生": HskEntry(hsk_level=1, pos_tags=("n",))},
        profiles=[manual],
    )

    await service.sync()

    assert repo.profiles["学生"] == manual  # untouched


async def test_summary_counts_and_flags_qualifier_shortage() -> None:
    service, _ = _service(
        known=["好", "跑", "书", "妈妈"],
        hsk={
            "好": HskEntry(1, ("a",)),
            "跑": HskEntry(2, ("v",)),
            "书": HskEntry(1, ("n",)),
            "妈妈": HskEntry(1, ("n",)),
        },
    )

    summary = await service.sync()

    assert summary.total == 4
    assert summary.categorised == 4
    assert summary.by_category["qualifier"] == 1
    assert summary.qualifier_shortage is True  # only 1 adjective, floor is 5


async def test_summary_reports_hsk_proficiency() -> None:
    service, _ = _service(
        known=["好", "跑", "书"],
        hsk={"好": HskEntry(1, ("a",)), "跑": HskEntry(1, ("v",)), "书": HskEntry(2, ("n",))},
        stats=HskLevelStats(total_by_level={1: 2, 2: 10}, functional_by_level={}),
    )

    summary = await service.sync()

    assert summary.proficiency.coverage_by_level == {1: 1.0, 2: 0.1}  # 2/2 and 1/10
    assert summary.proficiency.estimated_level == 1


async def test_override_stores_a_manual_profile_and_keeps_the_pos_tags() -> None:
    service, repo = _service(
        known=["老师"],
        hsk={"老师": HskEntry(3, ("n",))},
    )
    await service.sync()

    updated = await service.override("老师", VocabularyCategory.PERSON, hsk_level=3)

    assert updated.source is ProfileSource.MANUAL
    assert updated.pos_category is VocabularyCategory.PERSON
    assert updated.pos_tags == ("n",)  # preserved from the earlier hsk profile
    assert repo.profiles["老师"].source is ProfileSource.MANUAL


async def test_list_hydrates_pinyin_and_gloss_from_the_dictionary() -> None:
    dictionary = FakeDictionaryRepository(
        [make_dictionary_entry(entry_id=1, simplified="书", pinyin="shu1", definitions=("book",))]
    )
    service, _ = _service(known=["书"], hsk={"书": HskEntry(1, ("n",))}, dictionary=dictionary)
    await service.sync()

    listed = await service.list()

    assert (listed[0].pinyin, listed[0].gloss) == ("shu1", "book")
