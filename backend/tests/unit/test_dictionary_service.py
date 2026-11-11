from __future__ import annotations

import pytest

from shougong.usecase.commons.exceptions import ResourceNotFoundError
from shougong.usecase.dictionary.model import CedictRecord, DictionaryEntry, HskDatasetWord
from shougong.usecase.dictionary.service import DictionaryService
from tests.fixtures import (
    FakeCedictSource,
    FakeDictionaryRepository,
    FakeHskDatasetSource,
    make_dictionary_entry,
)

_RECORDS = [
    CedictRecord(simplified="学", pinyin="xue2", definitions=("to learn",)),
    CedictRecord(simplified="水", pinyin="shui3", definitions=("water",)),
]


async def test_get_returns_the_entry() -> None:
    service = DictionaryService(FakeDictionaryRepository([make_dictionary_entry(entry_id=7)]))

    entry = await service.get(7)

    assert entry.id == 7


async def test_get_unknown_id_raises_not_found() -> None:
    service = DictionaryService(FakeDictionaryRepository())

    with pytest.raises(ResourceNotFoundError):
        await service.get(123)


async def test_search_trims_query_and_respects_limit() -> None:
    entries = [make_dictionary_entry(entry_id=i, simplified="学习") for i in range(1, 6)]
    service = DictionaryService(FakeDictionaryRepository(entries))

    results = await service.search("  学  ", limit=3)

    assert len(results.items) == 3


async def test_search_pages_matches_with_an_exact_total() -> None:
    entries = [make_dictionary_entry(entry_id=i, simplified="学习") for i in range(1, 6)]
    service = DictionaryService(FakeDictionaryRepository(entries))

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
    service = DictionaryService(repo)

    added = await service.populate_if_empty(source)

    assert added == 2
    assert len(repo.entries) == 2


async def test_populate_if_empty_is_a_noop_when_already_populated() -> None:
    repo = FakeDictionaryRepository([make_dictionary_entry()])
    source = FakeCedictSource(_RECORDS)
    service = DictionaryService(repo)

    added = await service.populate_if_empty(source)

    assert added == 0
    assert source.fetch_calls == 0


async def test_enrich_hsk_stamps_every_row_that_shares_a_simplified() -> None:
    walk = make_dictionary_entry(entry_id=1, simplified="行", pinyin="xing2", definitions=("to walk",))
    firm = make_dictionary_entry(entry_id=2, simplified="行", pinyin="hang2", definitions=("firm",))
    other = make_dictionary_entry(entry_id=3, simplified="水", pinyin="shui3", definitions=("water",))
    repo = FakeDictionaryRepository([walk, firm, other])
    source = FakeHskDatasetSource({"行": HskDatasetWord("行", 2, ("v", "n"))})

    applied = await DictionaryService(repo).enrich_hsk(source)

    assert applied == 1
    assert [(e.simplified, e.hsk_level, e.pos_tags) for e in repo.entries] == [
        ("行", 2, ("v", "n")),
        ("行", 2, ("v", "n")),  # both readings of 行 stamped identically
        ("水", None, ()),  # untouched
    ]


async def test_enrich_hsk_is_a_noop_once_any_row_has_a_level() -> None:
    repo = FakeDictionaryRepository([make_dictionary_entry(simplified="书", hsk_level=1, pos_tags=("n",))])
    source = FakeHskDatasetSource({"书": HskDatasetWord("书", 3, ("n",))})

    applied = await DictionaryService(repo).enrich_hsk(source)

    assert applied == 0
    assert source.fetch_calls == 0
    assert repo.entries[0].hsk_level == 1  # not re-stamped


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
    service = DictionaryService(FakeDictionaryRepository(_knowing_family()))

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
    service = DictionaryService(FakeDictionaryRepository(entries))

    rows, _ = await service.related(1)

    # two shared hanzi first; within them hsk_level ASC NULLS LAST put 知道者 before 知道路
    assert [row.entry.id for row in rows] == [4, 3, 2]


async def test_related_unknown_target_raises_not_found() -> None:
    service = DictionaryService(FakeDictionaryRepository(_knowing_family()))

    with pytest.raises(ResourceNotFoundError):
        await service.related(123)


async def test_related_returns_an_empty_page_when_nothing_shares_a_character() -> None:
    entries = [
        make_dictionary_entry(entry_id=1, simplified="水"),
        make_dictionary_entry(entry_id=2, simplified="山"),
    ]
    service = DictionaryService(FakeDictionaryRepository(entries))

    rows, total = await service.related(1)

    assert rows == []
    assert total == 0


async def test_related_carries_the_queued_study_item_id() -> None:
    repo = FakeDictionaryRepository(_knowing_family(), study_items={3: 99})
    service = DictionaryService(repo)

    rows, _ = await service.related(1)

    assert {row.entry.id: row.study_item_id for row in rows} == {2: None, 3: 99, 4: None}


async def test_related_pages_without_changing_total() -> None:
    service = DictionaryService(FakeDictionaryRepository(_knowing_family()))

    rows, total = await service.related(1, limit=1, offset=1)

    assert total == 3
    assert [row.entry.id for row in rows] == [4]
