"""`HanziHeroConnectionRepository` — implements `IHanziHeroConnectionRepository` against MySQL."""

from __future__ import annotations

from shougong.persistence.configuration.time import as_utc as _as_utc
from shougong.persistence.configuration.time import naive_utc as _naive_utc
from shougong.persistence.configuration.transaction import (
    SqlAlchemyTransactionTemplate,
    current_session,
)
from shougong.persistence.hanzihero.entity import HanziHeroConnectionEntity
from shougong.usecase.hanzihero.gateway import IHanziHeroConnectionRepository
from shougong.usecase.hanzihero.model import HanziHeroConnection

_CONNECTION_ID = 1


def _to_domain(row: HanziHeroConnectionEntity) -> HanziHeroConnection:
    return HanziHeroConnection(
        session_cookie=row.session_cookie,
        connected_at=_as_utc(row.connected_at),
        last_synced_at=_as_utc(row.last_synced_at),
    )


class HanziHeroConnectionRepository(IHanziHeroConnectionRepository):
    def __init__(self, transaction_template: SqlAlchemyTransactionTemplate) -> None:
        self._tx = transaction_template

    async def get(self) -> HanziHeroConnection | None:
        async def _run() -> HanziHeroConnection | None:
            row = await current_session().get(HanziHeroConnectionEntity, _CONNECTION_ID)
            return _to_domain(row) if row is not None else None

        return await self._tx.execute(_run)

    async def save(self, connection: HanziHeroConnection) -> None:
        async def _run() -> None:
            last_synced_at = connection.last_synced_at
            await current_session().merge(
                HanziHeroConnectionEntity(
                    id=_CONNECTION_ID,
                    session_cookie=connection.session_cookie,
                    connected_at=_naive_utc(connection.connected_at),
                    last_synced_at=_naive_utc(last_synced_at) if last_synced_at is not None else None,
                )
            )

        await self._tx.execute(_run)
