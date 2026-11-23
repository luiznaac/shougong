"""Real local HTTP server (pytest-httpserver) standing in for the HSK character host."""

from __future__ import annotations

import httpx
from pytest_httpserver import HTTPServer

from shougong.gateway.dictionary.hsk_character_source import HskCharacterSource, parse_characters

_CSV = """Hanzi,Level,WritingLevel,Traditional,Freq,Examples
爱,1,1,愛,20,爱 爱好
班,1,2,班,14,班 上班
杯,1,2,杯,5,杯 杯子
帮,1,2,幫,4,帮 帮忙
揍,7-9,,揍,1,揍
行,2,7-9,行,9,行 行走
八,1,1,八,7,八 八卦
八,1,3,八,7,duplicate first row wins
"""


def test_parse_characters_keeps_levelled_characters_and_normalises_the_band() -> None:
    parsed = parse_characters(_CSV)

    assert set(parsed) == {"爱", "班", "杯", "帮", "行", "八"}
    assert parsed["班"].character == "班"
    assert parsed["班"].writing_level == 2
    assert parsed["行"].writing_level == 7  # the 7-9 band collapses to 7
    assert parsed["八"].writing_level == 1  # duplicate: first row wins
    assert "揍" not in parsed  # no writing level


async def test_fetch_downloads_the_csv_once_and_caches(httpserver: HTTPServer) -> None:
    httpserver.expect_request("/hsk30-chars.csv", method="GET").respond_with_data(_CSV, content_type="text/csv")

    async with httpx.AsyncClient() as client:
        source = HskCharacterSource(client, httpserver.url_for("/hsk30-chars.csv"))
        first = await source.fetch()
        second = await source.fetch()

    assert first is second  # cached
    assert len(httpserver.log) == 1  # downloaded only once
    assert first["班"].writing_level == 2
