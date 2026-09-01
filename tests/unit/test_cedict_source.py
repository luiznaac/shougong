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
        "garbage line without brackets",
    ]
)


def test_parse_cedict_skips_junk_and_drops_traditional() -> None:
    records = parse_cedict(_SAMPLE)

    assert [(r.simplified, r.pinyin, r.definitions) for r in records] == [
        ("学", "xue2", ("to learn", "to study")),
        ("水", "shui3", ("water",)),
    ]


async def test_fetch_downloads_gunzips_and_parses(httpserver: HTTPServer) -> None:
    httpserver.expect_request("/cedict.gz").respond_with_data(
        gzip.compress(_SAMPLE.encode("utf-8")),
        content_type="application/gzip",
    )

    async with httpx.AsyncClient() as client:
        source = CedictSource(client, httpserver.url_for("/cedict.gz"))
        records = await source.fetch()

    assert {r.simplified for r in records} == {"学", "水"}
