from __future__ import annotations

import httpx
import pytest
from pytest_httpserver import HTTPServer

from shougong.gateway.strokes.hanzi_writer_source import HanziWriterSource

_BODY = {
    "strokes": ["M 1 1 L 2 2", "M 3 3 L 4 4"],
    "medians": [[[1.0, 1.0], [2.0, 2.0]], [[3.0, 3.0], [4.0, 4.0]]],
}


async def test_fetch_parses_a_valid_response(httpserver: HTTPServer) -> None:
    httpserver.expect_request("/学.json").respond_with_json(_BODY)

    async with httpx.AsyncClient() as client:
        source = HanziWriterSource(client, httpserver.url_for("/{character}.json"))
        strokes = await source.fetch("学")

    assert strokes is not None
    assert strokes.character == "学"
    assert strokes.strokes == ("M 1 1 L 2 2", "M 3 3 L 4 4")
    assert strokes.medians == (((1.0, 1.0), (2.0, 2.0)), ((3.0, 3.0), (4.0, 4.0)))


async def test_fetch_returns_none_on_404(httpserver: HTTPServer) -> None:
    httpserver.expect_request("/。.json").respond_with_data(status=404)

    async with httpx.AsyncClient() as client:
        source = HanziWriterSource(client, httpserver.url_for("/{character}.json"))
        strokes = await source.fetch("。")

    assert strokes is None


async def test_fetch_raises_on_server_error(httpserver: HTTPServer) -> None:
    httpserver.expect_request("/学.json").respond_with_data(status=500)

    async with httpx.AsyncClient() as client:
        source = HanziWriterSource(client, httpserver.url_for("/{character}.json"))
        with pytest.raises(httpx.HTTPStatusError):
            await source.fetch("学")
