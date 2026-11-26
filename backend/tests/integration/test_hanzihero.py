"""HTTP acceptance for connecting a HanziHero account, against a faked HanziHero host."""

from __future__ import annotations

import httpx
from pytest_httpserver import HTTPServer
from sqlalchemy import text

from shougong.application.container import Container
from shougong.application.settings import HanziHeroConfig, Settings
from tests.hanzihero_fake import accept_login, login_page, reject_login


def _instance(settings: Settings, httpserver: HTTPServer) -> Container:
    return Container(settings.model_copy(update={"hanzihero": HanziHeroConfig(base_url=httpserver.url_for("/"))}))


def _serve_login_page(httpserver: HTTPServer) -> None:
    httpserver.expect_request("/users/log_in", method="GET").respond_with_handler(login_page)


async def _rows(instance: Container) -> list[dict[str, object]]:
    async with instance.engine.connect() as conn:
        result = await conn.execute(
            text("SELECT session_cookie, connected_at, last_synced_at FROM hanzihero_connection")
        )
        return [dict(row) for row in result.mappings()]


async def test_connect_then_status_reads_the_stored_connection(settings: Settings, httpserver: HTTPServer) -> None:
    _serve_login_page(httpserver)
    httpserver.expect_request("/users/log_in", method="POST").respond_with_handler(accept_login)
    instance = _instance(settings, httpserver)
    try:
        transport = httpx.ASGITransport(app=instance.app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            before = await client.get("/hanzihero/connection")
            assert before.status_code == 200
            assert before.json() == {"connected": False, "connected_at": None, "last_synced_at": None}

            connected = await client.post(
                "/hanzihero/connection",
                json={"email_username": "learner@example.com", "password": "s3cret"},
            )
            assert connected.status_code == 200
            body = connected.json()
            assert body["connected"] is True
            assert body["connected_at"] is not None
            assert body["last_synced_at"] is None

            after = await client.get("/hanzihero/connection")
            assert after.json() == body

        rows = await _rows(instance)
    finally:
        await instance.aclose()

    assert len(rows) == 1
    row = rows[0]
    assert row["session_cookie"] == "_hanzi_hero_key=authenticated"
    assert row["connected_at"] is not None
    assert row["last_synced_at"] is None
    for value in row.values():
        assert "s3cret" not in str(value)
        assert "learner@example.com" not in str(value)


async def test_a_rejected_login_is_a_400_and_stores_nothing(settings: Settings, httpserver: HTTPServer) -> None:
    _serve_login_page(httpserver)
    httpserver.expect_request("/users/log_in", method="POST").respond_with_handler(reject_login)
    instance = _instance(settings, httpserver)
    try:
        transport = httpx.ASGITransport(app=instance.app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.post(
                "/hanzihero/connection",
                json={"email_username": "learner@example.com", "password": "wrong-password"},
            )
            assert response.status_code == 400
            assert response.json()["code"] == "hanzihero_authentication_failed"
            assert "wrong-password" not in response.text
            assert "learner@example.com" not in response.text

            status = await client.get("/hanzihero/connection")
            assert status.json() == {"connected": False, "connected_at": None, "last_synced_at": None}

        rows = await _rows(instance)
    finally:
        await instance.aclose()

    assert rows == []


async def test_a_rejected_login_does_not_change_an_existing_connection(
    settings: Settings, httpserver: HTTPServer
) -> None:
    _serve_login_page(httpserver)
    httpserver.expect_oneshot_request("/users/log_in", method="POST").respond_with_handler(accept_login)
    httpserver.expect_request("/users/log_in", method="POST").respond_with_handler(reject_login)
    instance = _instance(settings, httpserver)
    try:
        transport = httpx.ASGITransport(app=instance.app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            first = await client.post(
                "/hanzihero/connection", json={"email_username": "learner@example.com", "password": "s3cret"}
            )
            assert first.status_code == 200

            rejected = await client.post(
                "/hanzihero/connection", json={"email_username": "learner@example.com", "password": "wrong-password"}
            )
            assert rejected.status_code == 400

            status = await client.get("/hanzihero/connection")
            assert status.json() == first.json()
    finally:
        await instance.aclose()


async def test_an_unreachable_hanzihero_is_a_502(settings: Settings, httpserver: HTTPServer) -> None:
    httpserver.expect_request("/users/log_in", method="GET").respond_with_data(status=503)
    instance = _instance(settings, httpserver)
    try:
        transport = httpx.ASGITransport(app=instance.app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            response = await client.post(
                "/hanzihero/connection", json={"email_username": "learner@example.com", "password": "s3cret"}
            )
            assert response.status_code == 502
            assert response.json()["code"] == "hanzihero_unavailable"
    finally:
        await instance.aclose()
