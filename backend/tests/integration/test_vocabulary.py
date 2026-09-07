from __future__ import annotations

import json

import httpx
from sqlalchemy import text

from shougong.application.container import Container


async def _seed_known(
    container: Container,
    simplified: str,
    pinyin: str,
    *,
    hsk_level: int | None = None,
    pos_tags: tuple[str, ...] = (),
) -> None:
    """Insert a dictionary entry and mark it studied, so it counts as a known word."""
    async with container.engine.begin() as conn:
        result = await conn.execute(
            text(
                "INSERT INTO dictionary_entry (simplified, pinyin, definitions, hsk_level, pos_tags) "
                "VALUES (:s, :p, :d, :l, :t)"
            ),
            {"s": simplified, "p": pinyin, "d": json.dumps(["gloss"]), "l": hsk_level, "t": json.dumps(list(pos_tags))},
        )
        entry_id = int(result.lastrowid)
        await conn.execute(
            text(
                "INSERT INTO study_item (entry_id, card_state, card_due, created_at) "
                "VALUES (:e, 0, '2026-01-01 00:00:00', '2026-01-01 00:00:00')"
            ),
            {"e": entry_id},
        )


async def _seed_hsk_only(
    container: Container, simplified: str, hsk_level: int, pos_tags: tuple[str, ...] = ("n",)
) -> None:
    """A dictionary entry that carries an HSK level but is not studied — it only
    contributes to the per-level totals (the proficiency denominator)."""
    async with container.engine.begin() as conn:
        await conn.execute(
            text(
                "INSERT INTO dictionary_entry (simplified, pinyin, definitions, hsk_level, pos_tags) "
                "VALUES (:s, 'x', :d, :l, :t)"
            ),
            {"s": simplified, "d": json.dumps(["gloss"]), "l": hsk_level, "t": json.dumps(list(pos_tags))},
        )


async def test_overview_returns_known_words_with_classes_and_a_summary(
    container: Container, client: httpx.AsyncClient
) -> None:
    await _seed_known(container, "书", "shu1", hsk_level=1, pos_tags=("n",))
    await _seed_known(container, "跑", "pao3", hsk_level=2, pos_tags=("v",))
    await _seed_hsk_only(container, "坏", 2)  # in HSK 2, not studied → widens the denominator
    await _seed_hsk_only(container, "累", 2)
    await _seed_hsk_only(container, "旧", 2)

    body = (await client.get("/reading-vocabulary")).json()

    assert {p["simplified"]: p["pinyin"] for p in body["profiles"]} == {"书": "shu1", "跑": "pao3"}
    assert {p["simplified"]: p["pos_categories"] for p in body["profiles"]} == {"书": ["noun"], "跑": ["verb"]}
    assert body["summary"]["total"] == 2
    assert body["summary"]["by_category"] == {"noun": 1, "verb": 1}
    assert body["summary"]["by_hsk_level"] == {"1": 1, "2": 1}
    assert body["summary"]["qualifier_shortage"] is True
    # level 1: 1 known of 1; level 2: 1 known of 4 (跑 + 坏/累/旧)
    assert body["summary"]["proficiency"] == {"coverage_by_level": {"1": 1.0, "2": 0.25}, "estimated_level": 1}


async def test_overview_is_empty_without_studied_words(container: Container, client: httpx.AsyncClient) -> None:
    await _seed_hsk_only(container, "书", 1)  # exists in the dictionary but not studied

    body = (await client.get("/reading-vocabulary")).json()

    assert body["profiles"] == []
    assert body["summary"]["total"] == 0
    assert body["summary"]["proficiency"] == {"coverage_by_level": {"1": 0.0}, "estimated_level": 0}
