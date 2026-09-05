from __future__ import annotations

import json

import httpx
from sqlalchemy import text

from shougong.application.container import Container

_WORD_TOKEN = {
    "is_word": True,
    "text": "学生",
    "pinyin": "xue2 sheng5",
    "definitions": ["student"],
    "part_of_speech": "substantivo",
    "is_extra": False,
    "dictionary_entry_id": 42,
}
_PUNCT_TOKEN = {"is_word": False, "text": "。"}


async def _seed(container: Container, *, created_at: str, topic: str | None = None) -> None:
    async with container.engine.begin() as conn:
        await conn.execute(
            text(
                "INSERT INTO reading_text "
                "(format, max_extra_words, topic, known_word_count, tokens, created_at) "
                "VALUES (:format, :max_extra_words, :topic, :known_word_count, :tokens, :created_at)"
            ),
            {
                "format": "paragraph",
                "max_extra_words": 2,
                "topic": topic,
                "known_word_count": 12,
                "tokens": json.dumps([_WORD_TOKEN, _PUNCT_TOKEN]),
                "created_at": created_at,
            },
        )


async def test_list_history_returns_saved_texts_newest_first(container: Container, client: httpx.AsyncClient) -> None:
    await _seed(container, created_at="2026-01-01 00:00:00", topic="older")
    await _seed(container, created_at="2026-01-02 00:00:00", topic="newer")

    response = await client.get("/reading-texts")

    assert response.status_code == 200
    body = response.json()
    assert [row["topic"] for row in body] == ["newer", "older"]

    first = body[0]
    assert first["known_word_count"] == 12
    word, punct = first["tokens"]
    assert word == {
        "text": "学生",
        "is_word": True,
        "pinyin": "xue2 sheng5",
        "definitions": ["student"],
        "part_of_speech": "substantivo",
        "is_extra": False,
        "dictionary_entry_id": 42,
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


async def test_list_history_respects_limit_and_offset(container: Container, client: httpx.AsyncClient) -> None:
    await _seed(container, created_at="2026-01-01 00:00:00", topic="a")
    await _seed(container, created_at="2026-01-02 00:00:00", topic="b")
    await _seed(container, created_at="2026-01-03 00:00:00", topic="c")

    response = await client.get("/reading-texts", params={"limit": 1, "offset": 1})

    assert response.status_code == 200
    assert [row["topic"] for row in response.json()] == ["b"]
