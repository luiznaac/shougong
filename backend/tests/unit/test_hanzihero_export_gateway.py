"""The HanziHero CSV-fetch adapter against a local fake server."""

from __future__ import annotations

import httpx
import pytest
from pytest_httpserver import HTTPServer
from werkzeug.wrappers import Request, Response

from shougong.gateway.hanzihero.export_gateway import HanziHeroExportGateway
from shougong.usecase.hanzihero.model import (
    HanziHeroExports,
    HanziHeroSessionExpiredError,
    HanziHeroUnavailableError,
)

_COOKIE = "_hanzi_hero_key=authenticated"


def _csv(body: str, captured: list[str | None]) -> Response:
    def _handler(request: Request) -> Response:
        captured.append(request.headers.get("Cookie"))
        return Response(body, content_type="text/plain; charset=utf-8")

    return _handler  # type: ignore[return-value]


def _serve_export(httpserver: HTTPServer, path: str, body: str, captured: list[str | None]) -> None:
    httpserver.expect_request(path, method="GET").respond_with_handler(_csv(body, captured))


async def test_fetch_exports_requests_all_three_with_the_session_cookie(httpserver: HTTPServer) -> None:
    captured: list[str | None] = []
    _serve_export(httpserver, "/simplified/characters.csv", "characters-body", captured)
    _serve_export(httpserver, "/simplified/words.csv", "words-body", captured)
    _serve_export(httpserver, "/simplified/my-dictionary.csv", "dictionary-body", captured)

    async with httpx.AsyncClient() as client:
        gateway = HanziHeroExportGateway(client, httpserver.url_for("/"))
        exports = await gateway.fetch_exports(_COOKIE)

    assert exports == HanziHeroExports(characters="characters-body", words="words-body", dictionary="dictionary-body")
    assert captured == [_COOKIE, _COOKIE, _COOKIE]
    assert [request.path for request, _ in httpserver.log] == [
        "/simplified/characters.csv",
        "/simplified/words.csv",
        "/simplified/my-dictionary.csv",
    ]


async def test_a_login_redirect_means_the_session_expired_and_stops_the_run(httpserver: HTTPServer) -> None:
    httpserver.expect_request("/simplified/characters.csv", method="GET").respond_with_handler(
        lambda _: Response("", status=303, headers={"Location": "/users/log_in"})
    )

    async with httpx.AsyncClient() as client:
        gateway = HanziHeroExportGateway(client, httpserver.url_for("/"))
        with pytest.raises(HanziHeroSessionExpiredError):
            await gateway.fetch_exports(_COOKIE)

    assert len(httpserver.log) == 1


async def test_a_later_login_redirect_aborts_before_the_last_fetch(httpserver: HTTPServer) -> None:
    _serve_export(httpserver, "/simplified/characters.csv", "characters-body", [])
    httpserver.expect_request("/simplified/words.csv", method="GET").respond_with_handler(
        lambda _: Response("", status=303, headers={"Location": "/users/log_in"})
    )

    async with httpx.AsyncClient() as client:
        gateway = HanziHeroExportGateway(client, httpserver.url_for("/"))
        with pytest.raises(HanziHeroSessionExpiredError):
            await gateway.fetch_exports(_COOKIE)

    assert [request.path for request, _ in httpserver.log] == [
        "/simplified/characters.csv",
        "/simplified/words.csv",
    ]


async def test_a_non_200_export_is_unavailable(httpserver: HTTPServer) -> None:
    httpserver.expect_request("/simplified/characters.csv", method="GET").respond_with_data(status=500)

    async with httpx.AsyncClient() as client:
        gateway = HanziHeroExportGateway(client, httpserver.url_for("/"))
        with pytest.raises(HanziHeroUnavailableError):
            await gateway.fetch_exports(_COOKIE)


async def test_a_transport_failure_is_unavailable() -> None:
    async with httpx.AsyncClient() as client:
        gateway = HanziHeroExportGateway(client, "http://127.0.0.1:1")
        with pytest.raises(HanziHeroUnavailableError):
            await gateway.fetch_exports(_COOKIE)
