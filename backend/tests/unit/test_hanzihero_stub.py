"""The dev-only HanziHero stub, driven through the real login gateway.

The acceptance run needs a HanziHero host that speaks the Phoenix login
handshake the login adapter expects. These tests pin the stub's HTTP contract by
running the real `HanziHeroLoginGateway` against it, so the stub cannot drift
from the adapter: the fixture credentials land a session cookie, any other
password is rejected, and the login page carries a CSRF token plus the pre-login
cookie.
"""

from __future__ import annotations

import threading
from collections.abc import Iterator

import httpx
import pytest

from shougong.acceptance import hanzihero_stub
from shougong.gateway.hanzihero.login_gateway import HanziHeroLoginGateway
from shougong.usecase.hanzihero.model import HanziHeroAuthenticationError


@pytest.fixture
def stub_url() -> Iterator[str]:
    server = hanzihero_stub.build_server("127.0.0.1", 0)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_address[1]}/"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


async def test_the_stub_satisfies_the_login_gateway_with_the_fixture_credentials(stub_url: str) -> None:
    async with httpx.AsyncClient() as client:
        gateway = HanziHeroLoginGateway(stub_url, client=client)
        session_cookie = await gateway.log_in(
            hanzihero_stub.ACCEPTED_IDENTIFIER,
            hanzihero_stub.ACCEPTED_PASSWORD,
        )

    assert session_cookie == "_hanzi_hero_key=authenticated"


async def test_the_stub_rejects_any_other_credentials(stub_url: str) -> None:
    async with httpx.AsyncClient() as client:
        gateway = HanziHeroLoginGateway(stub_url, client=client)
        with pytest.raises(HanziHeroAuthenticationError):
            await gateway.log_in(hanzihero_stub.ACCEPTED_IDENTIFIER, "wrong-password")


async def test_the_login_page_serves_a_csrf_token_and_pre_login_cookie(stub_url: str) -> None:
    async with httpx.AsyncClient() as client:
        response = await client.get(f"{stub_url}users/log_in")

    assert response.status_code == 200
    assert 'name="_csrf_token"' in response.text
    assert response.cookies["_hanzi_hero_key"] == "pre-login"
