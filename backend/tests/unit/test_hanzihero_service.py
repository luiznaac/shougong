from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from shougong.usecase.commons.time import FixedClock
from shougong.usecase.hanzihero.model import HanziHeroAuthenticationError, HanziHeroConnection, HanziHeroStatus
from shougong.usecase.hanzihero.service import HanziHeroService
from tests.fixtures import (
    FakeHanziHeroConnectionRepository,
    FakeTransactionTemplate,
    StubHanziHeroLoginGateway,
)

_NOW = datetime(2026, 1, 1, tzinfo=UTC)


def _service(
    repository: FakeHanziHeroConnectionRepository | None = None,
    gateway: StubHanziHeroLoginGateway | None = None,
) -> tuple[HanziHeroService, FakeHanziHeroConnectionRepository, StubHanziHeroLoginGateway]:
    repo = repository or FakeHanziHeroConnectionRepository()
    login = gateway or StubHanziHeroLoginGateway(session_cookie="_hanzi_hero_key=session")
    return HanziHeroService(repo, login, FixedClock(_NOW), FakeTransactionTemplate()), repo, login


async def test_connect_stores_only_the_session_cookie_and_connected_at() -> None:
    service, repo, login = _service()

    status = await service.connect("learner@example.com", "s3cret")

    assert status == HanziHeroStatus(connected_at=_NOW, last_synced_at=None)
    assert repo.connection == HanziHeroConnection(
        session_cookie="_hanzi_hero_key=session",
        connected_at=_NOW,
        last_synced_at=None,
    )
    # The credentials reached the login gateway, never the persisted row.
    assert login.calls == [("learner@example.com", "s3cret")]
    assert "s3cret" not in repr(repo.connection)
    assert "learner@example.com" not in repr(repo.connection)


async def test_a_rejected_login_stores_nothing() -> None:
    service, repo, _ = _service(gateway=StubHanziHeroLoginGateway(error=HanziHeroAuthenticationError("rejected")))

    with pytest.raises(HanziHeroAuthenticationError):
        await service.connect("learner@example.com", "wrong-password")

    assert repo.connection is None


async def test_a_rejected_login_does_not_change_an_existing_connection() -> None:
    existing = HanziHeroConnection(
        session_cookie="_hanzi_hero_key=old",
        connected_at=_NOW - timedelta(days=7),
        last_synced_at=_NOW - timedelta(days=1),
    )
    repo = FakeHanziHeroConnectionRepository(existing)
    service, _, _ = _service(
        repository=repo,
        gateway=StubHanziHeroLoginGateway(error=HanziHeroAuthenticationError("rejected")),
    )

    with pytest.raises(HanziHeroAuthenticationError):
        await service.connect("learner@example.com", "wrong-password")

    assert repo.connection == existing


async def test_status_before_any_connection_is_disconnected() -> None:
    service, _, _ = _service()

    assert await service.status() == HanziHeroStatus(connected_at=None, last_synced_at=None)


async def test_status_after_connect_has_no_last_synced_at() -> None:
    service, _, _ = _service()

    await service.connect("learner@example.com", "s3cret")

    assert await service.status() == HanziHeroStatus(connected_at=_NOW, last_synced_at=None)


async def test_reconnect_preserves_the_last_synced_at() -> None:
    synced_at = _NOW - timedelta(days=2)
    repo = FakeHanziHeroConnectionRepository(
        HanziHeroConnection(
            session_cookie="_hanzi_hero_key=old",
            connected_at=_NOW - timedelta(days=7),
            last_synced_at=synced_at,
        )
    )
    service, _, _ = _service(repository=repo)

    status = await service.connect("learner@example.com", "s3cret")

    assert status == HanziHeroStatus(connected_at=_NOW, last_synced_at=synced_at)
    assert repo.connection is not None
    assert repo.connection.session_cookie == "_hanzi_hero_key=session"
