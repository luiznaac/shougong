from __future__ import annotations

import gzip

import httpx
from pytest_httpserver import HTTPServer

from shougong.gateway.dictionary.cedict_source import CedictSource, parse_cedict

_SAMPLE = "\n".join(
    [
        "# CC-CEDICT sample",
        "學 学 [xue2] /to learn/to study/",
        "水 水 [shui3] /water/",
        "北京 北京 [Bei3 jing1] /Beijing/",
        "旅行 旅行 [lu:3 xing2] /to travel/",
        "garbage line without brackets",
    ]
)


def test_parse_cedict_skips_junk_drops_traditional_and_sanitizes_pinyin() -> None:
    records = parse_cedict(_SAMPLE)

    assert [(r.simplified, r.pinyin, r.definitions) for r in records] == [
        ("学", "xue2", ("to learn", "to study")),
        ("水", "shui3", ("water",)),
        ("北京", "bei3 jing1", ("Beijing",)),
        ("旅行", "lv3 xing2", ("to travel",)),
    ]


async def test_fetch_downloads_gunzips_and_parses(httpserver: HTTPServer) -> None:
    httpserver.expect_request("/cedict.gz").respond_with_data(
        gzip.compress(_SAMPLE.encode("utf-8")),
        content_type="application/gzip",
    )

    async with httpx.AsyncClient() as client:
        source = CedictSource(client, httpserver.url_for("/cedict.gz"))
        records = await source.fetch()

    assert {r.simplified for r in records} == {"学", "水", "北京", "旅行"}
