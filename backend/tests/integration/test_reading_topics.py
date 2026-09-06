from __future__ import annotations

import httpx


async def test_crud_over_the_scenario_list(client: httpx.AsyncClient) -> None:
    # add two
    a = (await client.post("/reading-topics", json={"scenario": "a lost key"})).json()
    await client.post("/reading-topics", json={"scenario": "a late bus"})

    listed = (await client.get("/reading-topics")).json()
    assert [t["scenario"] for t in listed] == ["a lost key", "a late bus"]
    assert all(t["active"] for t in listed)

    # deactivate the first
    patched = await client.patch(f"/reading-topics/{a['id']}", json={"active": False})
    assert patched.status_code == 200
    assert patched.json()["active"] is False

    # delete the first
    deleted = await client.delete(f"/reading-topics/{a['id']}")
    assert deleted.status_code == 204
    assert [t["scenario"] for t in (await client.get("/reading-topics")).json()] == ["a late bus"]


async def test_a_duplicate_scenario_is_a_409(client: httpx.AsyncClient) -> None:
    await client.post("/reading-topics", json={"scenario": "a lost key"})

    conflict = await client.post("/reading-topics", json={"scenario": "A Lost Key"})

    assert conflict.status_code == 409


async def test_patching_a_missing_topic_is_a_404(client: httpx.AsyncClient) -> None:
    assert (await client.patch("/reading-topics/999", json={"active": True})).status_code == 404
