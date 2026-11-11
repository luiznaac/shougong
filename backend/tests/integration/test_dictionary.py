from __future__ import annotations

import json

import httpx
from sqlalchemy import text

from shougong.application.container import Container
from shougong.persistence.dictionary.repository import DictionaryRepository
from shougong.usecase.dictionary.model import HskDatasetWord

_SEED = [
    {"s": "学", "p": "xue2", "d": ["to learn", "to study"]},
    {"s": "学习", "p": "xue2 xi2", "d": ["to learn", "to study"]},
    {"s": "水", "p": "shui3", "d": ["water"]},
]


async def _seed(container: Container) -> None:
    async with container.engine.begin() as conn:
        await conn.execute(
            text("INSERT INTO dictionary_entry (simplified, pinyin, definitions) VALUES (:s, :p, :d)"),
            [{"s": row["s"], "p": row["p"], "d": json.dumps(row["d"])} for row in _SEED],
        )


async def test_search_matches_hanzi_and_orders_by_length(container: Container, client: httpx.AsyncClient) -> None:
    await _seed(container)

    response = await client.get("/dictionary-entries", params={"q": "学"})

    assert response.status_code == 200
    assert [row["simplified"] for row in response.json()["items"]] == ["学", "学习"]
    assert response.json()["total"] == 2


async def test_search_pages_with_offset_and_keeps_the_total(container: Container, client: httpx.AsyncClient) -> None:
    await _seed(container)

    first = (await client.get("/dictionary-entries", params={"q": "学", "limit": 1})).json()
    second = (await client.get("/dictionary-entries", params={"q": "学", "limit": 1, "offset": 1})).json()
    empty = (await client.get("/dictionary-entries", params={"q": "没有"})).json()

    assert [row["simplified"] for row in first["items"]] == ["学"]
    assert [row["simplified"] for row in second["items"]] == ["学习"]
    assert first["total"] == second["total"] == 2
    assert empty == {"items": [], "total": 0, "limit": 20, "offset": 0}


async def test_get_by_id_returns_entry_and_missing_is_404(container: Container, client: httpx.AsyncClient) -> None:
    await _seed(container)
    listed = (await client.get("/dictionary-entries", params={"q": "shui3"})).json()["items"]

    found = await client.get(f"/dictionary-entries/{listed[0]['id']}")
    assert found.status_code == 200
    assert found.json()["definitions"] == ["water"]

    missing = await client.get("/dictionary-entries/999999")
    assert missing.status_code == 404


async def test_apply_hsk_stamps_all_rows_and_hsk_words_dedupes(container: Container) -> None:
    async with container.engine.begin() as conn:
        await conn.execute(
            text("INSERT INTO dictionary_entry (simplified, pinyin, definitions) VALUES (:s, :p, :d)"),
            [
                {"s": "行", "p": "xing2", "d": json.dumps(["to walk"])},
                {"s": "行", "p": "hang2", "d": json.dumps(["firm"])},
                {"s": "水", "p": "shui3", "d": json.dumps(["water"])},
            ],
        )

    repo = DictionaryRepository(container.transaction_template)
    assert await repo.count_with_hsk() == 0

    applied = await repo.apply_hsk({"行": HskDatasetWord("行", 2, ("v", "n"))})
    assert applied == 1
    assert await repo.count_with_hsk() == 2  # both readings of 行

    words = await repo.hsk_words()
    assert [(w.simplified, w.hsk_level, w.pos_tags) for w in words] == [("行", 2, ("v", "n"))]

    entries = await repo.find_by_simplified("行")
    assert all(e.hsk_level == 2 and e.pos_tags == ("v", "n") for e in entries)


_RELATED_SEED = [
    {"s": "知道", "p": "zhi1 dao4", "d": ["to know"], "hsk": 1},
    {"s": "知识", "p": "zhi1 shi5", "d": ["knowledge"], "hsk": 1},
    {"s": "知", "p": "zhi1", "d": ["to know"], "hsk": None},
    {"s": "道", "p": "dao4", "d": ["way"], "hsk": None},
    {"s": "知道路", "p": "zhi1 dao4 lu4", "d": ["to know the way"], "hsk": 2},
    {"s": "知道者", "p": "zhi1 dao4 zhe3", "d": ["knower"], "hsk": None},
    {"s": "认识", "p": "ren4 shi5", "d": ["to recognise"], "hsk": 1},
    {"s": "知道", "p": "zhi1 dao5", "d": ["alt reading"], "hsk": 1},
]


async def _seed_related(container: Container) -> dict[str, int]:
    async with container.engine.begin() as conn:
        await conn.execute(
            text("INSERT INTO dictionary_entry (simplified, pinyin, definitions, hsk_level) VALUES (:s, :p, :d, :hsk)"),
            [{"s": row["s"], "p": row["p"], "d": json.dumps(row["d"]), "hsk": row["hsk"]} for row in _RELATED_SEED],
        )
        rows = (await conn.execute(text("SELECT id, simplified, pinyin FROM dictionary_entry"))).all()
    return {f"{simplified}|{pinyin}": entry_id for entry_id, simplified, pinyin in rows}


async def test_related_lists_the_shared_character_family(container: Container, client: httpx.AsyncClient) -> None:
    ids = await _seed_related(container)
    target_id = ids["知道|zhi1 dao4"]

    response = await client.get(f"/dictionary-entries/{target_id}/related")

    assert response.status_code == 200
    page = response.json()
    assert page["total"] == 5
    assert page["limit"] == 20
    assert page["offset"] == 0
    # distinct shared hanzi DESC, then hsk_level ASC NULLS LAST, length ASC, id ASC
    assert [row["simplified"] for row in page["items"]] == ["知道路", "知道者", "知识", "知", "道"]
    assert all(row["study_item_id"] is None for row in page["items"])
    assert page["items"][0]["definitions"] == ["to know the way"]


async def test_related_pages_and_total_is_the_whole_family(container: Container, client: httpx.AsyncClient) -> None:
    ids = await _seed_related(container)
    target_id = ids["知道|zhi1 dao4"]

    response = await client.get(f"/dictionary-entries/{target_id}/related", params={"limit": 2, "offset": 1})

    page = response.json()
    assert page["total"] == 5
    assert page["limit"] == 2
    assert page["offset"] == 1
    assert [row["simplified"] for row in page["items"]] == ["知道者", "知识"]


async def test_related_carries_the_queued_study_item_id(container: Container, client: httpx.AsyncClient) -> None:
    ids = await _seed_related(container)
    target_id = ids["知道|zhi1 dao4"]
    queued_entry_id = ids["知|zhi1"]
    created = await client.post("/study-items", json={"dictionary_entry_id": queued_entry_id})
    assert created.status_code == 201
    study_item_id = created.json()["id"]

    page = (await client.get(f"/dictionary-entries/{target_id}/related")).json()

    by_simplified = {row["simplified"]: row["study_item_id"] for row in page["items"]}
    assert by_simplified["知"] == study_item_id
    assert by_simplified["道"] is None


async def test_related_unknown_target_is_404(container: Container, client: httpx.AsyncClient) -> None:
    response = await client.get("/dictionary-entries/999999/related")

    assert response.status_code == 404
