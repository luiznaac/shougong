from __future__ import annotations

import pytest

from shougong.usecase.commons.exceptions import ConflictError, InvalidArgumentError, ResourceNotFoundError
from shougong.usecase.commons.time import FixedClock
from shougong.usecase.reading.topic_service import ReadingTopicService
from tests.fixtures import FakeReadingTopicRepository, make_srs_card

_NOW = make_srs_card().due


def _service(scenarios: list[str] | None = None) -> tuple[ReadingTopicService, FakeReadingTopicRepository]:
    repo = FakeReadingTopicRepository(scenarios)
    return ReadingTopicService(repo, FixedClock(_NOW)), repo


async def test_add_trims_and_stores_a_scenario() -> None:
    service, repo = _service()

    added = await service.add("  a lost key  ")

    assert added.scenario == "a lost key"
    assert added.active is True
    assert [t.scenario for t in repo.topics] == ["a lost key"]


async def test_add_rejects_blank_and_duplicate_scenarios() -> None:
    service, _ = _service(["a lost key"])

    with pytest.raises(InvalidArgumentError):
        await service.add("   ")
    with pytest.raises(ConflictError):
        await service.add("A LOST KEY")


async def test_set_active_toggles_and_404s_on_a_missing_id() -> None:
    service, _ = _service(["a lost key"])
    listed = await service.list()

    updated = await service.set_active(listed[0].id, active=False)
    assert updated.active is False

    with pytest.raises(ResourceNotFoundError):
        await service.set_active(999, active=True)


async def test_delete_removes_the_scenario() -> None:
    service, _ = _service(["a lost key", "a late bus"])
    listed = await service.list()

    await service.delete(listed[0].id)

    assert [t.scenario for t in await service.list()] == ["a late bus"]
