"""Local fake HanziHero server (pytest-httpserver) driving the Phoenix login handshake."""

from __future__ import annotations

import httpx
import pytest
from pytest_httpserver import HTTPServer
from werkzeug.wrappers import Request, Response

from shougong.acceptance.hanzihero_stub import CSRF_TOKEN
from shougong.gateway.hanzihero.login_gateway import HanziHeroLoginGateway
from shougong.usecase.hanzihero.model import HanziHeroAuthenticationError, HanziHeroUnavailableError
from tests.hanzihero_fake import LOGIN_PAGE, login_page


async def test_log_in_performs_the_full_phoenix_handshake(httpserver: HTTPServer) -> None:
    captured: dict[str, object] = {}

    def _handle_post(request: Request) -> Response:
        captured["form"] = request.form.to_dict()
        captured["cookie"] = request.headers.get("Cookie")
        return Response(
            "",
            status=302,
            headers={"Location": "/", "Set-Cookie": "_hanzi_hero_key=authenticated; path=/; HttpOnly"},
        )

    httpserver.expect_request("/users/log_in", method="GET").respond_with_handler(login_page)
    httpserver.expect_request("/users/log_in", method="POST").respond_with_handler(_handle_post)

    async with httpx.AsyncClient() as client:
        gateway = HanziHeroLoginGateway(httpserver.url_for("/"), client=client)
        session_cookie = await gateway.log_in("learner@example.com", "s3cret")

    assert session_cookie == "_hanzi_hero_key=authenticated"
    assert captured["form"] == {
        "_csrf_token": CSRF_TOKEN,
        "user[email_username]": "learner@example.com",
        "user[password]": "s3cret",
        "user[remember_me]": "true",
    }
    assert "_hanzi_hero_key=pre-login" in str(captured["cookie"])


async def test_log_in_rejects_wrong_credentials(httpserver: HTTPServer) -> None:
    httpserver.expect_request("/users/log_in", method="GET").respond_with_handler(login_page)
    httpserver.expect_request("/users/log_in", method="POST").respond_with_data(LOGIN_PAGE, content_type="text/html")

    async with httpx.AsyncClient() as client:
        gateway = HanziHeroLoginGateway(httpserver.url_for("/"), client=client)
        with pytest.raises(HanziHeroAuthenticationError):
            await gateway.log_in("learner@example.com", "wrong-password")


async def test_log_in_reports_a_missing_csrf_token_as_unavailable(httpserver: HTTPServer) -> None:
    httpserver.expect_request("/users/log_in", method="GET").respond_with_data(
        "<html><body>no form here</body></html>", content_type="text/html"
    )

    async with httpx.AsyncClient() as client:
        gateway = HanziHeroLoginGateway(httpserver.url_for("/"), client=client)
        with pytest.raises(HanziHeroUnavailableError):
            await gateway.log_in("learner@example.com", "s3cret")


async def test_log_in_reports_an_upstream_error_as_unavailable(httpserver: HTTPServer) -> None:
    httpserver.expect_request("/users/log_in", method="GET").respond_with_data(status=503)

    async with httpx.AsyncClient() as client:
        gateway = HanziHeroLoginGateway(httpserver.url_for("/"), client=client)
        with pytest.raises(HanziHeroUnavailableError):
            await gateway.log_in("learner@example.com", "s3cret")


async def test_log_in_wraps_a_transport_failure() -> None:
    async with httpx.AsyncClient() as client:
        gateway = HanziHeroLoginGateway("http://127.0.0.1:1", client=client)
        with pytest.raises(HanziHeroUnavailableError):
            await gateway.log_in("learner@example.com", "s3cret")
