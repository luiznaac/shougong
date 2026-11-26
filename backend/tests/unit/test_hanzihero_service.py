from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from shougong.usecase.commons.time import FixedClock
from shougong.usecase.hanzihero.model import (
    HanziHeroAuthenticationError,
    HanziHeroConnection,
    HanziHeroExports,
    HanziHeroNotConnectedError,
    HanziHeroSessionExpiredError,
    HanziHeroStatus,
    HanziHeroUnavailableError,
)
from shougong.usecase.hanzihero.service import HanziHeroService
from shougong.usecase.study.model import ItemSource
from tests.fixtures import (
    FakeHanziHeroConnectionRepository,
    FakeTransactionTemplate,
    RecordingBatchImporter,
    StubHanziHeroExportGateway,
    StubHanziHeroLoginGateway,
)
from tests.hanzihero_fake import CHARACTERS_HEADER, DICTIONARY_HEADER, WORDS_HEADER

_NOW = datetime(2026, 1, 1, tzinfo=UTC)

_EXPORTS = HanziHeroExports(
    characters=CHARACTERS_HEADER + "一,yī,one,8,yi1,1,,,false\n",
    words=WORDS_HEADER + "手工,shǒugōng,handmade,7,shou3gong1,,,,false\n",
    dictionary=DICTIONARY_HEADER + "之中,zhīzhōng,inside,1,zhi1zhong1,inside::among,,,false\n",
)


def _connection(*, last_synced_at: datetime | None = None) -> HanziHeroConnection:
    return HanziHeroConnection(
        session_cookie="_hanzi_hero_key=stored",
        connected_at=_NOW - timedelta(days=7),
        last_synced_at=last_synced_at,
    )


def _service(
    repository: FakeHanziHeroConnectionRepository | None = None,
    gateway: StubHanziHeroLoginGateway | None = None,
    exports_gateway: StubHanziHeroExportGateway | None = None,
    importer: RecordingBatchImporter | None = None,
) -> tuple[
    HanziHeroService,
    FakeHanziHeroConnectionRepository,
    StubHanziHeroLoginGateway,
    StubHanziHeroExportGateway,
    RecordingBatchImporter,
]:
    repo = repository or FakeHanziHeroConnectionRepository()
    login = gateway or StubHanziHeroLoginGateway(session_cookie="_hanzi_hero_key=session")
    exporter = exports_gateway or StubHanziHeroExportGateway(_EXPORTS)
    batch = importer or RecordingBatchImporter()
    service = HanziHeroService(repo, login, exporter, batch, FixedClock(_NOW), FakeTransactionTemplate())
    return service, repo, login, exporter, batch


async def test_connect_stores_only_the_session_cookie_and_connected_at() -> None:
    service, repo, login, _, _ = _service()

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
    service, repo, _, _, _ = _service(gateway=StubHanziHeroLoginGateway(error=HanziHeroAuthenticationError("rejected")))

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
    service, _, _, _, _ = _service(
        repository=repo,
        gateway=StubHanziHeroLoginGateway(error=HanziHeroAuthenticationError("rejected")),
    )

    with pytest.raises(HanziHeroAuthenticationError):
        await service.connect("learner@example.com", "wrong-password")

    assert repo.connection == existing


async def test_status_before_any_connection_is_disconnected() -> None:
    service, _, _, _, _ = _service()

    assert await service.status() == HanziHeroStatus(connected_at=None, last_synced_at=None)


async def test_status_after_connect_has_no_last_synced_at() -> None:
    service, _, _, _, _ = _service()

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
    service, _, _, _, _ = _service(repository=repo)

    status = await service.connect("learner@example.com", "s3cret")

    assert status == HanziHeroStatus(connected_at=_NOW, last_synced_at=synced_at)
    assert repo.connection is not None
    assert repo.connection.session_cookie == "_hanzi_hero_key=session"


async def test_sync_without_a_connection_raises_and_imports_nothing() -> None:
    importer = RecordingBatchImporter()
    service, _, _, exporter, importer = _service(importer=importer)

    with pytest.raises(HanziHeroNotConnectedError):
        await service.sync()

    assert exporter.calls == []
    assert importer.calls == []


async def test_sync_imports_every_parsed_row_under_the_hanzihero_source() -> None:
    exporter = StubHanziHeroExportGateway(_EXPORTS)
    importer = RecordingBatchImporter()
    service, repo, _, exporter, importer = _service(
        repository=FakeHanziHeroConnectionRepository(_connection()),
        exports_gateway=exporter,
        importer=importer,
    )

    report = await service.sync()

    # The stored session, not the login credentials, drove the fetch.
    assert exporter.calls == ["_hanzi_hero_key=stored"]
    rows, source = importer.calls[0]
    assert [(row.hanzi, row.pinyin) for row in rows] == [
        ("一", "yi1"),
        ("手工", "shou3 gong1"),
        ("之中", "zhi1 zhong1"),
    ]
    assert source is ItemSource.HANZIHERO
    assert report.synced_at == _NOW
    assert repo.connection is not None
    assert repo.connection.last_synced_at == _NOW
    # A sync never rewrites the credential or the connection instant.
    assert repo.connection.session_cookie == "_hanzi_hero_key=stored"
    assert repo.connection.connected_at == _NOW - timedelta(days=7)


async def test_sync_chunks_a_large_export_at_the_batch_limit_and_renumbers_outcomes() -> None:
    rows = "".join(f"字{index},zi4,one,8,zi4,,,,false\n" for index in range(1001))
    exports = HanziHeroExports(
        characters=CHARACTERS_HEADER + rows,
        words=WORDS_HEADER,
        dictionary=DICTIONARY_HEADER,
    )
    importer = RecordingBatchImporter()
    service, _, _, _, importer = _service(
        repository=FakeHanziHeroConnectionRepository(_connection()),
        exports_gateway=StubHanziHeroExportGateway(exports),
        importer=importer,
    )

    report = await service.sync()

    assert [len(chunk) for chunk, _ in importer.calls] == [1000, 1]
    assert all(source is ItemSource.HANZIHERO for _, source in importer.calls)
    assert [outcome.row for outcome in report.outcomes] == list(range(1, 1002))


async def test_an_expired_session_imports_nothing_and_leaves_last_synced_unchanged() -> None:
    previous_sync = _NOW - timedelta(days=3)
    repo = FakeHanziHeroConnectionRepository(_connection(last_synced_at=previous_sync))
    exporter = StubHanziHeroExportGateway(error=HanziHeroSessionExpiredError("expired"))
    importer = RecordingBatchImporter()
    service, repo, _, exporter, importer = _service(repository=repo, exports_gateway=exporter, importer=importer)

    with pytest.raises(HanziHeroSessionExpiredError):
        await service.sync()

    assert importer.calls == []
    assert repo.connection is not None
    assert repo.connection.last_synced_at == previous_sync


async def test_a_failed_fetch_imports_nothing_and_leaves_last_synced_unchanged() -> None:
    repo = FakeHanziHeroConnectionRepository(_connection())
    exporter = StubHanziHeroExportGateway(error=HanziHeroUnavailableError("down"))
    importer = RecordingBatchImporter()
    service, repo, _, _, importer = _service(repository=repo, exports_gateway=exporter, importer=importer)

    with pytest.raises(HanziHeroUnavailableError):
        await service.sync()

    assert importer.calls == []
    assert repo.connection is not None
    assert repo.connection.last_synced_at is None
