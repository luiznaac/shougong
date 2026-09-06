from __future__ import annotations

import json

import httpx
from sqlalchemy import text

from shougong.application.container import Container


async def _seed_entry(container: Container, simplified: str, pinyin: str) -> int:
    async with container.engine.begin() as conn:
        result = await conn.execute(
            text("INSERT INTO dictionary_entry (simplified, pinyin, definitions) VALUES (:s, :p, :d)"),
            {"s": simplified, "p": pinyin, "d": json.dumps(["gloss"])},
        )
        return int(result.lastrowid)


async def _seed_profile(
    container: Container, simplified: str, *, hsk_level: int | None, pos_category: str, source: str = "hsk"
) -> None:
    async with container.engine.begin() as conn:
        await conn.execute(
            text(
                "INSERT INTO vocabulary_profile (simplified, hsk_level, pos_tags, pos_category, source, updated_at) "
                "VALUES (:s, :l, :t, :c, :src, '2026-01-01 00:00:00')"
            ),
            {"s": simplified, "l": hsk_level, "t": json.dumps(["n"]), "c": pos_category, "src": source},
        )


async def test_overview_returns_profiles_with_pinyin_and_a_summary(
    container: Container, client: httpx.AsyncClient
) -> None:
    await _seed_entry(container, "书", "shu1")
    await _seed_entry(container, "跑", "pao3")
    await _seed_profile(container, "书", hsk_level=1, pos_category="noun")
    await _seed_profile(container, "跑", hsk_level=2, pos_category="verb")

    body = (await client.get("/reading-vocabulary")).json()

    assert {p["simplified"]: p["pinyin"] for p in body["profiles"]} == {"书": "shu1", "跑": "pao3"}
    assert body["summary"]["total"] == 2
    assert body["summary"]["by_category"] == {"noun": 1, "verb": 1}
    assert body["summary"]["qualifier_shortage"] is True


async def test_override_persists_through_the_real_db(container: Container, client: httpx.AsyncClient) -> None:
    await _seed_entry(container, "老师", "lao3 shi1")
    await _seed_profile(container, "老师", hsk_level=3, pos_category="noun")

    patched = await client.patch("/reading-vocabulary/老师", json={"pos_category": "person", "hsk_level": 4})
    assert patched.status_code == 200
    assert patched.json() == {
        "simplified": "老师",
        "hsk_level": 4,
        "pos_tags": ["n"],  # preserved from the seeded hsk row
        "pos_category": "person",
        "source": "manual",
        "pinyin": None,
        "gloss": None,
    }

    reloaded = (await client.get("/reading-vocabulary")).json()["profiles"]
    assert next(p for p in reloaded if p["simplified"] == "老师")["pos_category"] == "person"
