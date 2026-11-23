from __future__ import annotations

import pytest
from opentelemetry.metrics import NoOpMeter

from shougong.usecase.commons.exceptions import ResourceNotFoundError
from shougong.usecase.dictionary.model import CedictRecord, DictionaryEntry, HskCharacter, HskDatasetWord
from shougong.usecase.dictionary.service import DictionaryService
from shougong.usecase.dictionary.telemetry import DictionaryTelemetry
from tests.fixtures import (
    FakeCedictSource,
    FakeDictionaryRepository,
    FakeHskCharacterSource,
    FakeHskDatasetSource,
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
    entries = [make_dictionary_entry(entry_id=i, simplified="学习") for i in range(1, 6)]
    service = _service(FakeDictionaryRepository(entries))

    results = await service.search("  学  ", limit=3)

    assert len(results.items) == 3


async def test_search_pages_matches_with_an_exact_total() -> None:
    entries = [make_dictionary_entry(entry_id=i, simplified="学习") for i in range(1, 6)]
    service = _service(FakeDictionaryRepository(entries))

    first = await service.search("学", limit=2, offset=0)
    second = await service.search("学", limit=2, offset=2)

    assert [e.id for e in first.items] == [1, 2]
    assert first.total == 5
    assert (first.limit, first.offset) == (2, 0)
    assert [e.id for e in second.items] == [3, 4]
    assert second.total == 5


async def test_populate_if_empty_loads_when_table_is_empty() -> None:
    repo = FakeDictionaryRepository()
    source = FakeCedictSource(_RECORDS)
    service = _service(repo)

    added = await service.populate_if_empty(source)

    assert added == 2
    assert len(repo.entries) == 2


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
    source = FakeHskDatasetSource({"行": HskDatasetWord("行", 2, ("v", "n"))})

    applied = await _service(repo).enrich_hsk(source, _characters({"行": 2}))

    assert applied == 1
    assert [(e.simplified, e.hsk_level, e.pos_tags) for e in repo.entries] == [
        ("行", 2, ("v", "n")),
        ("行", 2, ("v", "n")),  # both readings of 行 stamped identically
        ("水", None, ()),  # untouched
    ]


async def test_enrich_hsk_skips_when_the_stored_version_matches_the_code_version() -> None:
    repo = FakeDictionaryRepository(
        [make_dictionary_entry(entry_id=1, simplified="行", hsk_level=2, pos_tags=("v",))],
        enrichment_version=1,
    )
    source = FakeHskDatasetSource({"行": HskDatasetWord("行", 5, ("n",))})
    characters = _characters({"行": 2})

    applied = await _service(repo, enrichment_version=1).enrich_hsk(source, characters)

    assert applied == 0
    assert source.fetch_calls == 0
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
    source = FakeHskDatasetSource({"行": HskDatasetWord("行", 5, ("n", "v"))})

    applied = await _service(repo, enrichment_version=2).enrich_hsk(source, _characters({"行": 3}))

    assert applied == 1
    assert source.fetch_calls == 1
    # ids are preserved and every reading of 行 is re-stamped identically
    assert [(e.id, e.simplified, e.hsk_level, e.pos_tags) for e in repo.entries] == [
        (1, "行", 5, ("n", "v")),
        (2, "行", 5, ("n", "v")),
        (3, "水", None, ()),
    ]
    assert [e.handwriting_level for e in repo.entries] == [3, 3, None]
    assert repo.stored_enrichment_version == 2


async def test_an_empty_dictionary_leaves_the_version_unset_for_a_later_run() -> None:
    repo = FakeDictionaryRepository()
    source = FakeHskDatasetSource({"行": HskDatasetWord("行", 2, ())})
    characters = _characters({"行": 2})

    applied = await _service(repo, enrichment_version=1).enrich_hsk(source, characters)

    assert applied == 0
    assert source.fetch_calls == 0
    assert characters.fetch_calls == 0
    assert repo.stored_enrichment_version is None


async def test_an_empty_dataset_leaves_the_version_unset_for_a_later_run() -> None:
    repo = FakeDictionaryRepository([make_dictionary_entry(entry_id=1, simplified="行")])
    source = FakeHskDatasetSource()
    characters = _characters({"行": 2})

    applied = await _service(repo, enrichment_version=1).enrich_hsk(source, characters)

    assert applied == 0
    assert source.fetch_calls == 1
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
    source = FakeHskDatasetSource(
        {
            "爱人": HskDatasetWord("爱人", 2, ("n",)),
            "班": HskDatasetWord("班", 1, ("n",)),
        }
    )

    applied = await _service(repo).enrich_hsk(source, _characters({"爱": 1, "人": 1, "班": 2}))

    assert applied == 2
    assert repo.character_levels == {"爱": 1, "人": 1, "班": 2}
    assert [(e.simplified, e.handwriting_level) for e in repo.entries] == [
        ("爱人", 1),  # max of 爱 (1) and 人 (1)
        ("班", 2),
        ("水", None),  # no character has a writing level
    ]


async def test_an_empty_character_dataset_leaves_the_version_unset_for_a_later_run() -> None:
    repo = FakeDictionaryRepository([make_dictionary_entry(entry_id=1, simplified="班")])
    source = FakeHskDatasetSource({"班": HskDatasetWord("班", 1, ("n",))})
    characters = FakeHskCharacterSource()

    applied = await _service(repo).enrich_hsk(source, characters)

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


async def test_related_orders_by_shared_characters_then_hsk_then_length() -> None:
    entries = [
        make_dictionary_entry(entry_id=1, simplified="知道"),
        make_dictionary_entry(entry_id=2, simplified="知识", hsk_level=1),
        make_dictionary_entry(entry_id=3, simplified="知道路"),
        make_dictionary_entry(entry_id=4, simplified="知道者", hsk_level=2),
    ]
    service = _service(FakeDictionaryRepository(entries))

    rows, _ = await service.related(1)

    # two shared hanzi first; within them hsk_level ASC NULLS LAST put 知道者 before 知道路
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
