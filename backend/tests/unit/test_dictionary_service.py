from __future__ import annotations

import pytest

from shougong.usecase.commons.exceptions import ResourceNotFoundError
from shougong.usecase.dictionary.model import CedictRecord, HskDatasetWord
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

    assert len(results) == 3


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
