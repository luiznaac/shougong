from __future__ import annotations

import pytest
from opentelemetry.metrics import NoOpMeter

from shougong.usecase.commons.exceptions import ResourceNotFoundError
from shougong.usecase.dictionary.model import CedictRecord, DictionaryEntry, HskCharacter
from shougong.usecase.dictionary.service import DictionaryService
from shougong.usecase.dictionary.telemetry import DictionaryTelemetry
from tests.fixtures import (
    FakeCedictSource,
    FakeDictionaryRepository,
    FakeHskCharacterSource,
    FakeHskDatasetSource,
    FakeOfficialHskSource,
    make_dictionary_entry,
)

_RECORDS = [
    CedictRecord(simplified="学", pinyin="xue2", definitions=("to learn",)),
    CedictRecord(simplified="水", pinyin="shui3", definitions=("water",)),
]


def _service(repository: FakeDictionaryRepository, *, enrichment_version: int = 1) -> DictionaryService:
    return DictionaryService(
        repository,
        DictionaryTelemetry(NoOpMeter("test")),
        enrichment_version=enrichment_version,
    )


def _characters(levels: dict[str, int]) -> FakeHskCharacterSource:
    return FakeHskCharacterSource({c: HskCharacter(c, level) for c, level in levels.items()})


async def test_get_returns_the_entry() -> None:
    service = _service(FakeDictionaryRepository([make_dictionary_entry(entry_id=7)]))

    entry = await service.get(7)

    assert entry.id == 7


async def test_get_unknown_id_raises_not_found() -> None:
    service = _service(FakeDictionaryRepository())

    with pytest.raises(ResourceNotFoundError):
        await service.get(123)


async def test_search_trims_query_and_respects_limit() -> None:
    entries = [make_dictionary_entry(entry_id=i, simplified="学习", pinyin=f"xue2 xi{i}") for i in range(1, 6)]
    service = _service(FakeDictionaryRepository(entries))

    results = await service.search("  学  ", limit=3)

    assert len(results.items) == 3


async def test_search_pages_groups_with_an_exact_total() -> None:
    entries = [make_dictionary_entry(entry_id=i, simplified="学习", pinyin=f"xue2 xi{i}") for i in range(1, 6)]
    service = _service(FakeDictionaryRepository(entries))

    first = await service.search("学", limit=2, offset=0)
    second = await service.search("学", limit=2, offset=2)

    assert [group.meanings[0].entry_id for group in first.items] == [1, 2]
    assert first.total == 5
    assert (first.limit, first.offset) == (2, 0)
    assert [group.meanings[0].entry_id for group in second.items] == [3, 4]
    assert second.total == 5


async def test_populate_if_empty_loads_when_table_is_empty() -> None:
    repo = FakeDictionaryRepository()
    source = FakeCedictSource(_RECORDS)
    service = _service(repo)

    added = await service.populate_if_empty(source)

    assert added == 2
    assert len(repo.entries) == 2


async def test_populate_if_empty_applies_the_import_policy() -> None:
    repo = FakeDictionaryRepository()
    source = FakeCedictSource(
        [
            CedictRecord(simplified="吃", pinyin="chi1", definitions=("to eat",)),
            CedictRecord(simplified="吃", pinyin="chi1", definitions=("variant of 吃[chi1]",)),
            CedictRecord(simplified="水", pinyin="shui3", definitions=("water",)),
            CedictRecord(simplified="水", pinyin="shui3", definitions=("water",)),
            CedictRecord(simplified="㑳", pinyin="zhou4", definitions=("old variant of 媰[zhou4]",)),
        ]
    )
    service = _service(repo)

    added = await service.populate_if_empty(source)

    assert added == 3
    assert [(e.simplified, e.definitions) for e in repo.entries] == [
        ("吃", ("to eat",)),
        ("水", ("water",)),
        ("㑳", ("old variant of 媰[zhou4]",)),
    ]


async def test_populate_if_empty_is_a_noop_when_already_populated() -> None:
    repo = FakeDictionaryRepository([make_dictionary_entry()])
    source = FakeCedictSource(_RECORDS)
    service = _service(repo)

    added = await service.populate_if_empty(source)

    assert added == 0
    assert source.fetch_calls == 0


async def test_enrich_hsk_stamps_every_row_that_shares_a_simplified() -> None:
    walk = make_dictionary_entry(entry_id=1, simplified="行", pinyin="xing2", definitions=("to walk",))
    firm = make_dictionary_entry(entry_id=2, simplified="行", pinyin="hang2", definitions=("firm",))
    other = make_dictionary_entry(entry_id=3, simplified="水", pinyin="shui3", definitions=("water",))
    repo = FakeDictionaryRepository([walk, firm, other])
    official = FakeOfficialHskSource({"行": 2})
    community = FakeHskDatasetSource({"行": ("v", "n")})

    applied = await _service(repo).enrich_hsk(official, community, _characters({"行": 2}))

    assert applied == 1
    assert [(e.simplified, e.hsk_level, e.pos_tags, e.handwriting_level) for e in repo.entries] == [
        ("行", 2, ("v", "n"), 2),
        ("行", 2, ("v", "n"), 2),  # both readings of 行 stamped identically
        ("水", None, (), None),  # outside the official list → cleared
    ]


async def test_enrich_hsk_uses_the_official_level_and_the_community_pos_tags() -> None:
    repo = FakeDictionaryRepository([make_dictionary_entry(entry_id=1, simplified="行")])
    official = FakeOfficialHskSource({"行": 2})
    community = FakeHskDatasetSource({"行": ("v", "n")})

    await _service(repo).enrich_hsk(official, community, _characters({"行": 2}))

    assert (repo.entries[0].hsk_level, repo.entries[0].pos_tags) == (2, ("v", "n"))


async def test_enrich_hsk_clears_the_level_for_a_word_outside_the_official_list() -> None:
    repo = FakeDictionaryRepository([make_dictionary_entry(entry_id=1, simplified="旧", hsk_level=3, pos_tags=("a",))])
    official = FakeOfficialHskSource({"新": 1})
    community = FakeHskDatasetSource({"新": ("a",)})

    await _service(repo).enrich_hsk(official, community, _characters({"新": 1}))

    assert (repo.entries[0].hsk_level, repo.entries[0].pos_tags) == (None, ())


async def test_enrich_hsk_skips_when_the_stored_version_matches_the_code_version() -> None:
    repo = FakeDictionaryRepository(
        [make_dictionary_entry(entry_id=1, simplified="行", hsk_level=2, pos_tags=("v",))],
        enrichment_version=1,
    )
    official = FakeOfficialHskSource({"行": 5})
    community = FakeHskDatasetSource({"行": ("n",)})
    characters = _characters({"行": 2})

    applied = await _service(repo, enrichment_version=1).enrich_hsk(official, community, characters)

    assert applied == 0
    assert official.fetch_calls == 0
    assert community.fetch_calls == 0
    assert characters.fetch_calls == 0
    assert repo.entries[0].hsk_level == 2  # not re-stamped


async def test_advancing_the_version_re_enriches_every_row_in_place_and_persists_it() -> None:
    repo = FakeDictionaryRepository(
        [
            make_dictionary_entry(entry_id=1, simplified="行", pinyin="xing2", hsk_level=2, pos_tags=("v",)),
            make_dictionary_entry(entry_id=2, simplified="行", pinyin="hang2", hsk_level=2, pos_tags=("v",)),
            make_dictionary_entry(entry_id=3, simplified="水", pinyin="shui3"),
        ],
        enrichment_version=1,
    )
    official = FakeOfficialHskSource({"行": 5})
    community = FakeHskDatasetSource({"行": ("n", "v")})

    applied = await _service(repo, enrichment_version=2).enrich_hsk(official, community, _characters({"行": 3}))

    assert applied == 1
    assert official.fetch_calls == 1
    assert community.fetch_calls == 1
    # ids are preserved and every reading of 行 is re-stamped identically
    assert [(e.id, e.simplified, e.hsk_level, e.pos_tags, e.handwriting_level) for e in repo.entries] == [
        (1, "行", 5, ("n", "v"), 3),
        (2, "行", 5, ("n", "v"), 3),
        (3, "水", None, (), None),
    ]
    assert repo.stored_enrichment_version == 2
    assert repo.stored_official_level_totals == {5: 1}


async def test_advancing_the_version_cleans_alias_and_duplicate_rows_in_place() -> None:
    repo = FakeDictionaryRepository(
        [
            make_dictionary_entry(entry_id=1, simplified="吃", pinyin="chi1", definitions=("to eat",)),
            make_dictionary_entry(entry_id=2, simplified="吃", pinyin="chi1", definitions=("variant of 吃[chi1]",)),
            make_dictionary_entry(entry_id=3, simplified="水", pinyin="shui3", definitions=("water",)),
            make_dictionary_entry(entry_id=4, simplified="水", pinyin="shui3", definitions=("water",)),
            make_dictionary_entry(
                entry_id=5, simplified="㑳", pinyin="zhou4", definitions=("old variant of 媰[zhou4]",)
            ),
        ],
        enrichment_version=1,
        protected={2},  # a study item queued the alias; the cleanup must keep it
    )
    source = FakeHskDatasetSource({"吃": ("v",)})

    applied = await _service(repo, enrichment_version=2).enrich_hsk(
        FakeOfficialHskSource({"吃": 1}), source, _characters({"吃": 1})
    )

    assert applied == 1
    # the protected alias survives; the unprotected duplicate and only the
    # unprotected alias are removed; kept rows keep their ids
    assert [e.id for e in repo.entries] == [1, 2, 3, 5]
    assert repo.stored_enrichment_version == 2


async def test_a_matching_version_leaves_alias_rows_untouched() -> None:
    repo = FakeDictionaryRepository(
        [
            make_dictionary_entry(entry_id=1, simplified="吃", pinyin="chi1", definitions=("to eat",)),
            make_dictionary_entry(entry_id=2, simplified="吃", pinyin="chi1", definitions=("variant of 吃[chi1]",)),
        ],
        enrichment_version=2,
    )
    source = FakeHskDatasetSource({"吃": ("v",)})

    applied = await _service(repo, enrichment_version=2).enrich_hsk(
        FakeOfficialHskSource({"吃": 1}), source, _characters({"吃": 1})
    )

    assert applied == 0
    assert [e.id for e in repo.entries] == [1, 2]


async def test_an_empty_dictionary_leaves_the_version_unset_for_a_later_run() -> None:
    repo = FakeDictionaryRepository()
    official = FakeOfficialHskSource({"行": 2})
    community = FakeHskDatasetSource({"行": ()})
    characters = _characters({"行": 2})

    applied = await _service(repo, enrichment_version=1).enrich_hsk(official, community, characters)

    assert applied == 0
    assert official.fetch_calls == 0
    assert community.fetch_calls == 0
    assert characters.fetch_calls == 0
    assert repo.stored_enrichment_version is None


async def test_an_empty_official_list_leaves_the_version_unset_for_a_later_run() -> None:
    repo = FakeDictionaryRepository([make_dictionary_entry(entry_id=1, simplified="行")])
    official = FakeOfficialHskSource()
    community = FakeHskDatasetSource({"行": ("n",)})
    characters = _characters({"行": 2})

    applied = await _service(repo, enrichment_version=1).enrich_hsk(official, community, characters)

    assert applied == 0
    assert official.fetch_calls == 1
    assert characters.fetch_calls == 0  # no character fetch after a failed word source
    assert repo.stored_enrichment_version is None


async def test_an_empty_community_dataset_leaves_the_version_unset_for_a_later_run() -> None:
    repo = FakeDictionaryRepository([make_dictionary_entry(entry_id=1, simplified="行")])
    official = FakeOfficialHskSource({"行": 2})
    community = FakeHskDatasetSource()
    characters = _characters({"行": 2})

    applied = await _service(repo, enrichment_version=1).enrich_hsk(official, community, characters)

    assert applied == 0
    assert community.fetch_calls == 1
    assert characters.fetch_calls == 0
    assert repo.stored_enrichment_version is None


async def test_enrich_hsk_populates_character_levels_and_derives_the_handwriting_rollup() -> None:
    repo = FakeDictionaryRepository(
        [
            make_dictionary_entry(entry_id=1, simplified="爱人", hsk_level=2),
            make_dictionary_entry(entry_id=2, simplified="班", hsk_level=1),
            make_dictionary_entry(entry_id=3, simplified="水"),
        ]
    )
    official = FakeOfficialHskSource({"爱人": 2, "班": 1})
    community = FakeHskDatasetSource({"爱人": ("n",), "班": ("n",)})

    applied = await _service(repo).enrich_hsk(official, community, _characters({"爱": 1, "人": 1, "班": 2}))

    assert applied == 2
    assert repo.character_levels == {"爱": 1, "人": 1, "班": 2}
    assert [(e.simplified, e.handwriting_level) for e in repo.entries] == [
        ("爱人", 1),  # max of 爱 (1) and 人 (1)
        ("班", 2),
        ("水", None),  # no character has a writing level
    ]


async def test_an_empty_character_dataset_leaves_the_version_unset_for_a_later_run() -> None:
    repo = FakeDictionaryRepository([make_dictionary_entry(entry_id=1, simplified="班")])
    official = FakeOfficialHskSource({"班": 1})
    community = FakeHskDatasetSource({"班": ("n",)})
    characters = FakeHskCharacterSource()

    applied = await _service(repo).enrich_hsk(official, community, characters)

    assert applied == 0
    assert characters.fetch_calls == 1
    assert repo.entries[0].handwriting_level is None
    assert repo.stored_enrichment_version is None


def _knowing_family() -> list[DictionaryEntry]:
    return [
        make_dictionary_entry(entry_id=1, simplified="知道", pinyin="zhi1 dao4"),
        make_dictionary_entry(entry_id=2, simplified="知识", pinyin="zhi1 shi5"),
        make_dictionary_entry(entry_id=3, simplified="知", pinyin="zhi1"),
        make_dictionary_entry(entry_id=4, simplified="道", pinyin="dao4"),
        make_dictionary_entry(entry_id=5, simplified="认识", pinyin="ren4 shi5"),
        make_dictionary_entry(entry_id=6, simplified="知道", pinyin="zhi1 dao5"),
    ]


async def test_related_matches_shared_characters_excluding_target_and_its_readings() -> None:
    service = _service(FakeDictionaryRepository(_knowing_family()))

    rows, total = await service.related(1)

    assert total == 3
    # single-character neighbours come before the two-character word (length ASC)
    assert [row.entry.simplified for row in rows] == ["知", "道", "知识"]


async def test_related_orders_by_shared_characters_then_handwriting_then_length() -> None:
    entries = [
        make_dictionary_entry(entry_id=1, simplified="知道"),
        make_dictionary_entry(entry_id=2, simplified="知识", handwriting_level=1),
        make_dictionary_entry(entry_id=3, simplified="知道路"),
        make_dictionary_entry(entry_id=4, simplified="知道者", handwriting_level=2),
    ]
    service = _service(FakeDictionaryRepository(entries))

    rows, _ = await service.related(1)

    # two shared hanzi first; within them handwriting_level ASC NULLS LAST put 知道者 before 知道路
    assert [row.entry.id for row in rows] == [4, 3, 2]


async def test_related_unknown_target_raises_not_found() -> None:
    service = _service(FakeDictionaryRepository(_knowing_family()))

    with pytest.raises(ResourceNotFoundError):
        await service.related(123)


async def test_related_returns_an_empty_page_when_nothing_shares_a_character() -> None:
    entries = [
        make_dictionary_entry(entry_id=1, simplified="水"),
        make_dictionary_entry(entry_id=2, simplified="山"),
    ]
    service = _service(FakeDictionaryRepository(entries))

    rows, total = await service.related(1)

    assert rows == []
    assert total == 0


async def test_related_carries_the_queued_study_item_id() -> None:
    repo = FakeDictionaryRepository(_knowing_family(), study_items={3: 99})
    service = _service(repo)

    rows, _ = await service.related(1)

    assert {row.entry.id: row.study_item_id for row in rows} == {2: None, 3: 99, 4: None}


async def test_related_pages_without_changing_total() -> None:
    service = _service(FakeDictionaryRepository(_knowing_family()))

    rows, total = await service.related(1, limit=1, offset=1)

    assert total == 3
    assert [row.entry.id for row in rows] == [4]
