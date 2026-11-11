from __future__ import annotations

import json
from typing import Any

import httpx
from pytest_httpserver import HTTPServer
from sqlalchemy import text

from shougong.application.container import Container
from shougong.application.settings import AiGatewayConfig, GatewaysConfig, Settings

WORD_STUDENT = {"is_word": True, "text": "学生", "part_of_speech": "noun", "is_extra": False}
PUNCT_STOP = {"is_word": False, "text": "。"}


async def _seed_entry(container: Container, simplified: str = "学生", pinyin: str = "xue2 sheng5") -> int:
    async with container.engine.begin() as conn:
        result = await conn.execute(
            text("INSERT INTO dictionary_entry (simplified, pinyin, definitions) VALUES (:s, :p, :d)"),
            {"s": simplified, "p": pinyin, "d": json.dumps(["student"])},
        )
        return int(result.lastrowid)


async def _seed_reading(
    container: Container,
    *,
    created_at: str,
    topic: str | None = None,
    topic_generated: bool = False,
    model: str = "claude-haiku-4-5",
    tokens: list[dict[str, Any]] | None = None,
    attempts: list[dict[str, Any]] | None = None,
    working_set: dict[str, list[str]] | None = None,
    must_use: list[str] | None = None,
    max_attempts: int = 3,
    speakers: list[dict[str, Any]] | None = None,
    text_format: str = "paragraph",
) -> int:
    async with container.engine.begin() as conn:
        result = await conn.execute(
            text(
                "INSERT INTO reading_text "
                "(format, max_extra_words, max_attempts, topic, topic_generated, model, known_word_count, "
                "tokens, attempts, working_set, must_use, speakers, created_at) "
                "VALUES (:format, 2, :max_attempts, :topic, :topic_generated, :model, 12, "
                ":tokens, :attempts, :working_set, :must_use, :speakers, :created_at)"
            ),
            {
                "format": text_format,
                "max_attempts": max_attempts,
                "topic": topic,
                "topic_generated": topic_generated,
                "model": model,
                "tokens": json.dumps(tokens if tokens is not None else [WORD_STUDENT, PUNCT_STOP]),
                "attempts": json.dumps(attempts or []),
                "working_set": json.dumps(working_set or {}),
                "must_use": json.dumps(must_use or []),
                "speakers": json.dumps(speakers or []),
                "created_at": created_at,
            },
        )
        return int(result.lastrowid)


async def test_list_readings_returns_summary_rows_newest_first(container: Container, client: httpx.AsyncClient) -> None:
    attempts = [
        {
            "attempt": 1,
            "text": "我是猫。",
            "segmentation": ["我", "是", "猫", "。"],
            "extra_words": ["猫", "狗"],
            "prompt_tokens": 700,
            "completion_tokens": 40,
            "chosen": False,
        },
        {
            "attempt": 2,
            "text": "我是学生。",
            "segmentation": ["我", "是", "学生", "。"],
            "extra_words": ["猫"],
            "prompt_tokens": 760,
            "completion_tokens": 55,
            "chosen": True,
        },
    ]
    await _seed_reading(container, created_at="2026-01-01 00:00:00", topic="older")
    await _seed_reading(
        container,
        created_at="2026-01-02 00:00:00",
        topic="a wrong package",
        topic_generated=True,
        model="claude-sonnet-4-5",
        attempts=attempts,
    )

    response = await client.get("/reading-texts")

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 2
    assert (body["limit"], body["offset"]) == (20, 0)
    assert [row["topic"] for row in body["items"]] == ["a wrong package", "older"]
    assert [row["model"] for row in body["items"]] == ["claude-sonnet-4-5", "claude-haiku-4-5"]
    assert [row["topic_generated"] for row in body["items"]] == [True, False]

    first = body["items"][0]
    # Summary rows never carry the token/attempt payload.
    assert set(first) == {
        "id",
        "format",
        "topic",
        "topic_generated",
        "model",
        "extra_word_count",
        "token_count",
        "attempt_count",
        "created_at",
        "preview",
        "match",
    }
    assert first["format"] == "paragraph"
    assert first["extra_word_count"] == 1  # of the chosen draft
    assert first["token_count"] == 2
    assert first["attempt_count"] == 2
    assert first["preview"] == "学生。"
    assert first["match"] is None
    assert body["items"][1]["attempt_count"] == 1  # rows written before the correction loop


async def test_list_readings_honours_limit_offset_and_the_exact_total(
    container: Container, client: httpx.AsyncClient
) -> None:
    await _seed_reading(container, created_at="2026-01-01 00:00:00", topic="a")
    await _seed_reading(container, created_at="2026-01-02 00:00:00", topic="b")
    await _seed_reading(container, created_at="2026-01-03 00:00:00", topic="c")

    response = await client.get("/reading-texts", params={"limit": 1, "offset": 1})

    assert response.status_code == 200
    body = response.json()
    assert [row["topic"] for row in body["items"]] == ["b"]
    assert body["total"] == 3
    assert (body["limit"], body["offset"]) == (1, 1)


async def test_list_readings_by_entry_returns_matches_with_a_snippet(
    container: Container, client: httpx.AsyncClient
) -> None:
    entry_id = await _seed_entry(container)
    context = [
        {"is_word": True, "text": "我", "part_of_speech": "pronoun", "is_extra": False},
        {"is_word": False, "text": "，"},
        WORD_STUDENT,
        PUNCT_STOP,
        {"is_word": True, "text": "他", "part_of_speech": "pronoun", "is_extra": False},
    ]
    await _seed_reading(container, created_at="2026-01-01 00:00:00", topic="without", tokens=[PUNCT_STOP])
    await _seed_reading(container, created_at="2026-01-02 00:00:00", topic="with", tokens=context)

    response = await client.get("/reading-texts", params={"entry_id": entry_id})

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 1
    row = body["items"][0]
    assert row["topic"] == "with"
    assert row["match"] == {"before": "我，", "hit": "学生", "after": "。他"}


async def test_list_readings_by_unknown_entry_is_an_empty_page(container: Container, client: httpx.AsyncClient) -> None:
    await _seed_reading(container, created_at="2026-01-01 00:00:00")

    response = await client.get("/reading-texts", params={"entry_id": 999_999, "limit": 8, "offset": 3})

    assert response.status_code == 200
    assert response.json() == {"items": [], "total": 0, "limit": 8, "offset": 3}


async def test_get_reading_returns_the_full_reading(container: Container, client: httpx.AsyncClient) -> None:
    entry_id = await _seed_entry(container)
    attempts = [
        {
            "attempt": 1,
            "text": "我是猫。",
            "segmentation": ["我", "是", "猫", "。"],
            "extra_words": ["猫"],
            "prompt_tokens": 700,
            "completion_tokens": 40,
            "chosen": False,
        },
        {
            "attempt": 2,
            "text": "我是学生。",
            "segmentation": ["我", "是", "学生", "。"],
            "extra_words": [],
            "prompt_tokens": 760,
            "completion_tokens": 55,
            "chosen": True,
        },
    ]
    reading_id = await _seed_reading(
        container,
        created_at="2026-02-01 00:00:00",
        attempts=attempts,
        working_set={"verbs": ["是"], "nouns": ["学生"]},
        must_use=["学生"],
    )

    response = await client.get(f"/reading-texts/{reading_id}")

    assert response.status_code == 200
    row = response.json()
    assert row["id"] == reading_id
    assert row["max_attempts"] == 3
    assert (row["prompt_tokens"], row["completion_tokens"]) == (1460, 95)  # summed across attempts
    assert [a["chosen"] for a in row["attempts"]] == [False, True]
    assert row["attempts"][0]["segmentation"] == ["我", "是", "猫", "。"]
    assert row["attempts"][0]["extra_words"] == ["猫"]
    assert row["extra_words"] == []  # of the chosen draft
    assert row["working_set"] == {"verbs": ["是"], "nouns": ["学生"]}
    assert row["must_use"] == ["学生"]
    # pinyin/definitions/dictionary_entry_id are never stored — they come back
    # hydrated from the dictionary_entry row seeded above, keyed by word text.
    word, punct = row["tokens"]
    assert word == {
        "text": "学生",
        "is_word": True,
        "pinyin": "xue2 sheng5",
        "definitions": ["student"],
        "part_of_speech": "noun",
        "is_extra": False,
        "dictionary_entry_id": entry_id,
        "speaker": None,
    }
    assert punct == {
        "text": "。",
        "is_word": False,
        "pinyin": None,
        "definitions": [],
        "part_of_speech": None,
        "is_extra": False,
        "dictionary_entry_id": None,
        "speaker": None,
    }
    assert row["speakers"] == []


async def test_get_reading_404s_for_an_unknown_id(container: Container, client: httpx.AsyncClient) -> None:
    response = await client.get("/reading-texts/999999")

    assert response.status_code == 404
    assert response.json()["code"] == "resource_not_found"


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


async def test_get_reading_tolerates_a_part_of_speech_from_before_the_enum_changed(
    container: Container, client: httpx.AsyncClient
) -> None:
    reading_id = await _seed_reading(
        container,
        created_at="2026-01-01 00:00:00",
        tokens=[{"is_word": True, "text": "学生", "part_of_speech": "outro", "is_extra": False}],
    )

    response = await client.get(f"/reading-texts/{reading_id}")

    assert response.status_code == 200
    assert response.json()["tokens"][0]["part_of_speech"] is None


async def test_get_reading_round_trips_a_dialogue_with_speakers(
    container: Container, client: httpx.AsyncClient
) -> None:
    def word(speaker: str) -> dict[str, Any]:
        return {"is_word": True, "text": "好", "part_of_speech": "adjective", "is_extra": False, "speaker": speaker}

    reading_id = await _seed_reading(
        container,
        created_at="2026-03-01 00:00:00",
        text_format="dialogue",
        max_attempts=4,
        tokens=[word("哥"), {"is_word": False, "text": "\n", "speaker": "哥"}, word("妹")],
        speakers=[{"name": "哥", "pinyin": None}, {"name": "妹", "pinyin": None}],
    )

    response = await client.get(f"/reading-texts/{reading_id}")

    assert response.status_code == 200
    row = response.json()
    assert row["format"] == "dialogue"
    assert row["max_attempts"] == 4
    assert row["speakers"] == [{"name": "哥", "pinyin": None}, {"name": "妹", "pinyin": None}]
    assert [t["speaker"] for t in row["tokens"]] == ["哥", "哥", "妹"]
