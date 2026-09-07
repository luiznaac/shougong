"""Real local HTTP server (pytest-httpserver) standing in for the HSK dataset host."""

from __future__ import annotations

import httpx
from pytest_httpserver import HTTPServer

from shougong.gateway.reading.hsk_vocabulary_source import HskVocabularySource, parse_dataset

_DATASET = [
    {"s": "阿姨", "l": ["t3", "n4", "o3"], "p": ["n"]},
    {"s": "北京", "l": ["n2", "o1"], "p": ["ns"]},
    {"s": "呵护", "l": ["o7"], "p": ["v", "vn"]},
    {"s": "他", "l": ["n1"], "p": ["r"]},  # pronoun, not in FUNCTIONAL_CORE → not FUNCTIONAL
    {"s": "的", "l": ["n1"], "p": ["u"]},  # particle → FUNCTIONAL
    {"s": "了", "l": ["n1"], "p": ["u"]},  # FUNCTIONAL
    {"s": "会", "l": ["n2"], "p": ["v"]},  # in FUNCTIONAL_CORE → FUNCTIONAL despite the verb tag
    {"s": "", "l": ["n1"], "p": ["x"]},  # skipped: no simplified form
]


def test_parse_dataset_keeps_simplified_level_and_pos() -> None:
    parsed = parse_dataset(_DATASET)

    assert {"阿姨", "北京", "呵护", "他"} <= set(parsed)
    assert parsed["阿姨"].hsk_level == 4  # lowest `nN`, ignoring `tN`
    assert parsed["北京"].hsk_level == 2
    assert parsed["呵护"].hsk_level == 7  # no `nN` → lowest `oN`
    assert parsed["呵护"].pos_tags == ("v", "vn")


async def test_fetch_downloads_once_and_caches(httpserver: HTTPServer) -> None:
    httpserver.expect_request("/complete.min.json", method="GET").respond_with_json(_DATASET)

    async with httpx.AsyncClient() as client:
        source = HskVocabularySource(client, httpserver.url_for("/complete.min.json"))
        first = await source.fetch()
        second = await source.fetch()

    assert first is second  # cached
    assert len(httpserver.log) == 1  # downloaded only once
    assert first["北京"].hsk_level == 2


async def test_level_stats_counts_totals_and_isolates_function_words(httpserver: HTTPServer) -> None:
    httpserver.expect_request("/complete.min.json", method="GET").respond_with_json(_DATASET)

    async with httpx.AsyncClient() as client:
        source = HskVocabularySource(client, httpserver.url_for("/complete.min.json"))
        stats = await source.level_stats()
        again = await source.level_stats()

    assert again is stats  # memoised
    assert len(httpserver.log) == 1  # reuses the fetched dataset
    assert stats.total_by_level == {1: 3, 2: 2, 4: 1, 7: 1}  # entries with an HSK level, per level
    assert stats.functional_by_level[1] == frozenset({"的", "了"})
    assert stats.functional_by_level[2] == frozenset({"会"})
    assert "他" not in stats.functional_by_level.get(1, frozenset())
