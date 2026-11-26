"""HTTP acceptance for connecting a HanziHero account and syncing its vocabulary."""

from __future__ import annotations

import json

import httpx
from pytest_httpserver import HTTPServer
from sqlalchemy import text

from shougong.application.container import Container
from shougong.application.settings import HanziHeroConfig, Settings
from tests.hanzihero_fake import (
    CHARACTERS_HEADER,
    DICTIONARY_HEADER,
    WORDS_HEADER,
    accept_login,
    csv_response,
    login_page,
    redirect_to_login,
    reject_login,
)


def _instance(settings: Settings, httpserver: HTTPServer) -> Container:
    return Container(settings.model_copy(update={"hanzihero": HanziHeroConfig(base_url=httpserver.url_for("/"))}))


def _serve_login_page(httpserver: HTTPServer) -> None:
    httpserver.expect_request("/users/log_in", method="GET").respond_with_handler(login_page)


def _serve_exports(httpserver: HTTPServer, *, characters: str, words: str, dictionary: str) -> None:
    httpserver.expect_request("/simplified/characters.csv", method="GET").respond_with_handler(csv_response(characters))
    httpserver.expect_request("/simplified/words.csv", method="GET").respond_with_handler(csv_response(words))
    httpserver.expect_request("/simplified/my-dictionary.csv", method="GET").respond_with_handler(
        csv_response(dictionary)
    )


def _serve_expired_exports(httpserver: HTTPServer) -> None:
    for path in ("/simplified/characters.csv", "/simplified/words.csv", "/simplified/my-dictionary.csv"):
        httpserver.expect_request(path, method="GET").respond_with_handler(redirect_to_login)


def _export_requests(httpserver: HTTPServer) -> list[tuple[str, str | None]]:
    return [
        (request.path, request.headers.get("Cookie")) for request, _ in httpserver.log if request.path.endswith(".csv")
    ]


async def _seed_entry(
    instance: Container, *, simplified: str, pinyin: str, definitions: list[str] | None = None
) -> int:
    async with instance.engine.begin() as conn:
        result = await conn.execute(
            text("INSERT INTO dictionary_entry (simplified, pinyin, definitions) VALUES (:s, :p, :d)"),
            {"s": simplified, "p": pinyin, "d": json.dumps(definitions or ["gloss"])},
        )
        return int(result.lastrowid)


async def _connect(client: httpx.AsyncClient) -> None:
    response = await client.post(
        "/hanzihero/connection", json={"email_username": "learner@example.com", "password": "s3cret"}
    )
    assert response.status_code == 200


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


_EXPORTS = {
    "characters": CHARACTERS_HEADER + "一,yī,one,8,yi1,1,,,false\n" + "不,bù,no,8,bu4,not,,,false\n",
    "words": WORDS_HEADER + "手工,shǒugōng,handmade,7,shou3gong1,,,,false\n" + "谢,xiè,thanks,8,xie4,,,,true\n",
    "dictionary": DICTIONARY_HEADER + "之中,zhīzhōng,inside,1,zhi1zhong1,inside::among,,,false\n",
}


def _serve_known_exports(httpserver: HTTPServer) -> None:
    _serve_exports(httpserver, **_EXPORTS)


async def test_sync_imports_matched_items_and_reports_counts(settings: Settings, httpserver: HTTPServer) -> None:
    _serve_login_page(httpserver)
    httpserver.expect_request("/users/log_in", method="POST").respond_with_handler(accept_login)
    _serve_known_exports(httpserver)
    instance = _instance(settings, httpserver)
    try:
        await _seed_entry(instance, simplified="一", pinyin="yi1")
        await _seed_entry(instance, simplified="手工", pinyin="shou3 gong1")
        await _seed_entry(instance, simplified="之中", pinyin="zhi1 zhong1")
        await _seed_entry(instance, simplified="谢", pinyin="xie4")
        transport = httpx.ASGITransport(app=instance.app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            await _connect(client)

            response = await client.post("/hanzihero/sync")
            assert response.status_code == 200
            body = response.json()
            assert (body["created"], body["already_in_queue"], body["unmatched"]) == (3, 0, 1)
            assert len(body["outcomes"]) == 4
            assert body["last_synced_at"] is not None

            listed = await client.get("/study-items")
            assert {row["entry"]["simplified"] for row in listed.json()["items"]} == {"一", "手工", "之中"}

            status = await client.get("/hanzihero/connection")
            assert status.json()["last_synced_at"] == body["last_synced_at"]

        exports = _export_requests(httpserver)
    finally:
        await instance.aclose()

    assert [path for path, _ in exports] == [
        "/simplified/characters.csv",
        "/simplified/words.csv",
        "/simplified/my-dictionary.csv",
    ]
    assert all(cookie == "_hanzi_hero_key=authenticated" for _, cookie in exports)


async def test_a_second_sync_duplicates_nothing_and_resets_no_progress(
    settings: Settings, httpserver: HTTPServer
) -> None:
    _serve_login_page(httpserver)
    httpserver.expect_request("/users/log_in", method="POST").respond_with_handler(accept_login)
    _serve_known_exports(httpserver)
    instance = _instance(settings, httpserver)
    try:
        await _seed_entry(instance, simplified="一", pinyin="yi1")
        await _seed_entry(instance, simplified="手工", pinyin="shou3 gong1")
        await _seed_entry(instance, simplified="之中", pinyin="zhi1 zhong1")
        transport = httpx.ASGITransport(app=instance.app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            await _connect(client)
            first = (await client.post("/hanzihero/sync")).json()
            assert first["created"] == 3

            items = (await client.get("/study-items")).json()["items"]
            item_ids = {row["id"] for row in items}
            target = items[0]["id"]
            graded = await client.post(f"/study-items/{target}/reviews", json={"rating": "good"})
            assert graded.status_code == 201

            second = (await client.post("/hanzihero/sync")).json()
            assert second["created"] == 0
            assert second["already_in_queue"] == 3
            assert second["unmatched"] == 1

            after = (await client.get("/study-items")).json()["items"]
            assert {row["id"] for row in after} == item_ids
            reviewed = (await client.get(f"/study-items/{target}")).json()
            assert reviewed["card"]["state"] == "review"
            assert reviewed["card"]["last_review"] is not None
    finally:
        await instance.aclose()


async def test_an_expired_session_is_a_reconnect_error_and_leaves_last_synced_unchanged(
    settings: Settings, httpserver: HTTPServer
) -> None:
    _serve_login_page(httpserver)
    httpserver.expect_request("/users/log_in", method="POST").respond_with_handler(accept_login)
    _serve_expired_exports(httpserver)
    instance = _instance(settings, httpserver)
    try:
        await _seed_entry(instance, simplified="一", pinyin="yi1")
        transport = httpx.ASGITransport(app=instance.app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            await _connect(client)

            response = await client.post("/hanzihero/sync")
            assert response.status_code == 409
            assert response.json()["code"] == "hanzihero_reconnect_required"

            assert (await client.get("/study-items")).json()["total"] == 0
            status = await client.get("/hanzihero/connection")
            assert status.json()["connected"] is True
            assert status.json()["last_synced_at"] is None

        exports = _export_requests(httpserver)
    finally:
        await instance.aclose()

    assert [path for path, _ in exports] == ["/simplified/characters.csv"]


async def test_sync_reports_candidate_readings_for_an_unmatched_row(settings: Settings, httpserver: HTTPServer) -> None:
    _serve_login_page(httpserver)
    httpserver.expect_request("/users/log_in", method="POST").respond_with_handler(accept_login)
    _serve_exports(
        httpserver,
        characters=CHARACTERS_HEADER,
        words=WORDS_HEADER,
        dictionary=DICTIONARY_HEADER + "行,háng,OK,8,hang2,OK,,,false\n",
    )
    instance = _instance(settings, httpserver)
    try:
        await _seed_entry(instance, simplified="行", pinyin="xing2", definitions=["to walk"])
        transport = httpx.ASGITransport(app=instance.app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:
            await _connect(client)

            body = (await client.post("/hanzihero/sync")).json()

        assert (body["created"], body["already_in_queue"], body["unmatched"]) == (0, 0, 1)
        outcome = body["outcomes"][0]
        assert outcome["status"] == "error"
        assert [(candidate["simplified"], candidate["pinyin"]) for candidate in outcome["candidates"]] == [
            ("行", "xing2")
        ]
    finally:
        await instance.aclose()
