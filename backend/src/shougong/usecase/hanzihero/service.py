"""`HanziHeroService` — connect an account and read the stored connection status."""

from __future__ import annotations

from shougong.usecase.commons.time import IClock
from shougong.usecase.configuration.transaction import ITransactionTemplate
from shougong.usecase.hanzihero.gateway import IHanziHeroConnectionRepository, IHanziHeroLoginGateway
from shougong.usecase.hanzihero.model import HanziHeroConnection, HanziHeroStatus


class HanziHeroService:
    def __init__(
        self,
        repository: IHanziHeroConnectionRepository,
        login_gateway: IHanziHeroLoginGateway,
        clock: IClock,
        transaction_template: ITransactionTemplate,
    ) -> None:
        self._repository = repository
        self._login = login_gateway
        self._clock = clock
        self._tx = transaction_template

    async def connect(self, identifier: str, password: str) -> HanziHeroStatus:
        """Log in to HanziHero and store only the resulting session cookie.

        A rejected login raises before anything is written, so a wrong password
        leaves the existing connection untouched. A reconnect keeps the prior
        `last_synced_at`: the sync history is not reset by re-authenticating.
        """
        session_cookie = await self._login.log_in(identifier, password)
        connected_at = self._clock.now()

        async def _run() -> HanziHeroStatus:
            existing = await self._repository.get()
            last_synced_at = existing.last_synced_at if existing is not None else None
            await self._repository.save(
                HanziHeroConnection(
                    session_cookie=session_cookie,
                    connected_at=connected_at,
                    last_synced_at=last_synced_at,
                )
            )
            return HanziHeroStatus(connected_at=connected_at, last_synced_at=last_synced_at)

        return await self._tx.execute(_run)

    async def status(self) -> HanziHeroStatus:
        connection = await self._repository.get()
        if connection is None:
            return HanziHeroStatus(connected_at=None, last_synced_at=None)
        return HanziHeroStatus(
            connected_at=connection.connected_at,
            last_synced_at=connection.last_synced_at,
        )
