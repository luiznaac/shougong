from __future__ import annotations

import pytest

from shougong.usecase.commons.exceptions import ResourceNotFoundError
from shougong.usecase.dictionary.model import CedictRecord
from shougong.usecase.dictionary.service import DictionaryService
from tests.fixtures import FakeCedictSource, FakeDictionaryRepository, make_dictionary_entry

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
