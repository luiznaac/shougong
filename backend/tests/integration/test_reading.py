from __future__ import annotations

import json

import httpx
from pytest_httpserver import HTTPServer
from sqlalchemy import text

from shougong.application.container import Container
from shougong.application.settings import AiGatewayConfig, GatewaysConfig, Settings

_PUNCT_TOKEN = {"is_word": False, "text": "。"}


async def _seed_entry(container: Container) -> int:
    async with container.engine.begin() as conn:
        result = await conn.execute(
            text("INSERT INTO dictionary_entry (simplified, pinyin, definitions) VALUES (:s, :p, :d)"),
            {"s": "学生", "p": "xue2 sheng5", "d": json.dumps(["student"])},
        )
        return int(result.lastrowid)


async def _seed_reading(
    container: Container, *, created_at: str, topic: str | None = None, model: str = "claude-haiku-4-5"
) -> None:
    word_token = {
        "is_word": True,
        "text": "学生",
        "part_of_speech": "noun",
        "is_extra": False,
    }
    async with container.engine.begin() as conn:
        await conn.execute(
            text(
                "INSERT INTO reading_text "
                "(format, max_extra_words, topic, model, known_word_count, tokens, created_at) "
                "VALUES (:format, :max_extra_words, :topic, :model, :known_word_count, :tokens, :created_at)"
            ),
            {
                "format": "paragraph",
                "max_extra_words": 2,
                "topic": topic,
                "model": model,
                "known_word_count": 12,
                "tokens": json.dumps([word_token, _PUNCT_TOKEN]),
                "created_at": created_at,
            },
        )


async def test_list_history_returns_saved_texts_newest_first(container: Container, client: httpx.AsyncClient) -> None:
    entry_id = await _seed_entry(container)
    await _seed_reading(container, created_at="2026-01-01 00:00:00", topic="older", model="claude-haiku-4-5")
    await _seed_reading(container, created_at="2026-01-02 00:00:00", topic="newer", model="claude-sonnet-4-5")

    response = await client.get("/reading-texts")

    assert response.status_code == 200
    body = response.json()
    assert [row["topic"] for row in body] == ["newer", "older"]
    assert [row["model"] for row in body] == ["claude-sonnet-4-5", "claude-haiku-4-5"]

    first = body[0]
    assert first["known_word_count"] == 12
    word, punct = first["tokens"]
    # pinyin/definitions/dictionary_entry_id are never stored — they come back
    # hydrated from the dictionary_entry row seeded above, keyed by word text.
    assert word == {
        "text": "学生",
        "is_word": True,
        "pinyin": "xue2 sheng5",
        "definitions": ["student"],
        "part_of_speech": "noun",
        "is_extra": False,
        "dictionary_entry_id": entry_id,
    }
    assert punct == {
        "text": "。",
        "is_word": False,
        "pinyin": None,
        "definitions": [],
        "part_of_speech": None,
        "is_extra": False,
        "dictionary_entry_id": None,
    }


async def test_list_history_tolerates_a_part_of_speech_from_before_the_enum_changed(
    container: Container, client: httpx.AsyncClient
) -> None:
    word_token = {"is_word": True, "text": "学生", "part_of_speech": "outro", "is_extra": False}
    async with container.engine.begin() as conn:
        await conn.execute(
            text(
                "INSERT INTO reading_text (format, max_extra_words, topic, known_word_count, tokens, created_at) "
                "VALUES ('paragraph', 2, NULL, 0, :tokens, '2026-01-01 00:00:00')"
            ),
            {"tokens": json.dumps([word_token])},
        )

    response = await client.get("/reading-texts")

    assert response.status_code == 200
    assert response.json()[0]["tokens"][0]["part_of_speech"] is None


async def test_list_models_proxies_the_ai_gateway(settings: Settings, httpserver: HTTPServer) -> None:
    httpserver.expect_request("/models", method="GET").respond_with_json(
        {"data": [{"id": "claude-sonnet-4-5"}, {"id": "claude-haiku-4-5"}]}
    )
    ai_settings = settings.model_copy(
        update={"gateways": GatewaysConfig(ai=AiGatewayConfig(base_url=httpserver.url_for("/"), api_key="sk-test"))}
    )
    instance = Container(ai_settings)
    try:
        transport = httpx.ASGITransport(app=instance.app)
        async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as ai_client:
            response = await ai_client.get("/reading-texts/models")
    finally:
        await instance.aclose()

    assert response.status_code == 200
    assert response.json() == ["claude-haiku-4-5", "claude-sonnet-4-5"]


async def test_list_history_respects_limit_and_offset(container: Container, client: httpx.AsyncClient) -> None:
    await _seed_entry(container)
    await _seed_reading(container, created_at="2026-01-01 00:00:00", topic="a")
    await _seed_reading(container, created_at="2026-01-02 00:00:00", topic="b")
    await _seed_reading(container, created_at="2026-01-03 00:00:00", topic="c")

    response = await client.get("/reading-texts", params={"limit": 1, "offset": 1})

    assert response.status_code == 200
    assert [row["topic"] for row in response.json()] == ["b"]
