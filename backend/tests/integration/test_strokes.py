from __future__ import annotations

import json

import httpx
from sqlalchemy import text

from shougong.application.container import Container


async def _seed_hit(container: Container, character: str) -> None:
    async with container.engine.begin() as conn:
        await conn.execute(
            text("INSERT INTO character_strokes (`character`, has_data, strokes, medians) VALUES (:c, 1, :s, :m)"),
            {
                "c": character,
                "s": json.dumps(["M 1 1 L 2 2"]),
                "m": json.dumps([[[1.0, 1.0], [2.0, 2.0]]]),
            },
        )


async def _seed_miss(container: Container, character: str) -> None:
    async with container.engine.begin() as conn:
        await conn.execute(
            text("INSERT INTO character_strokes (`character`, has_data, strokes, medians) VALUES (:c, 0, NULL, NULL)"),
            {"c": character},
        )


async def test_get_strokes_for_cached_character(container: Container, client: httpx.AsyncClient) -> None:
    await _seed_hit(container, "学")

    response = await client.get("/characters/学/strokes")

    assert response.status_code == 200
    body = response.json()
    assert body["character"] == "学"
    assert body["strokes"] == ["M 1 1 L 2 2"]
    assert body["medians"] == [[[1.0, 1.0], [2.0, 2.0]]]


async def test_get_strokes_for_negatively_cached_character_is_404(
    container: Container, client: httpx.AsyncClient
) -> None:
    await _seed_miss(container, "。")

    response = await client.get("/characters/。/strokes")

    assert response.status_code == 404


async def test_get_strokes_rejects_multi_character_path(container: Container, client: httpx.AsyncClient) -> None:
    response = await client.get("/characters/学习/strokes")

    assert response.status_code == 422
