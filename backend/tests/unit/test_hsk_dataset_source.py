"""Real local HTTP server (pytest-httpserver) standing in for the community dataset host."""

from __future__ import annotations

import httpx
from pytest_httpserver import HTTPServer

from shougong.gateway.dictionary.hsk_dataset_source import HskDatasetSource, parse_pos_tags

_DATASET = [
    {"s": "阿姨", "l": ["t3", "n4", "o3"], "p": ["n"]},
    {"s": "北京", "l": ["n2", "o1"], "p": ["ns"]},
    {"s": "呵护", "l": ["o7"], "p": ["v", "vn"]},
    {"s": "他", "l": ["n1"], "p": ["r"]},
    {"s": "的", "l": ["n1"], "p": ["u"]},
    {"s": "", "l": ["n1"], "p": ["x"]},  # skipped: no simplified form
]


def test_parse_pos_tags_keeps_the_simplified_form_and_pos() -> None:
    parsed = parse_pos_tags(_DATASET)

    assert {"阿姨", "北京", "呵护", "他"} <= set(parsed)
    assert parsed["阿姨"] == ("n",)
    assert parsed["北京"] == ("ns",)
    assert parsed["呵护"] == ("v", "vn")


async def test_fetch_downloads_once_and_caches(httpserver: HTTPServer) -> None:
    httpserver.expect_request("/complete.min.json", method="GET").respond_with_json(_DATASET)

    async with httpx.AsyncClient() as client:
        source = HskDatasetSource(client, httpserver.url_for("/complete.min.json"))
        first = await source.fetch()
        second = await source.fetch()

    assert first is second  # cached
    assert len(httpserver.log) == 1  # downloaded only once
    assert first["北京"] == ("ns",)
