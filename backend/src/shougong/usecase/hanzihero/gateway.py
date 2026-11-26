"""Outbound ports for the HanziHero slice. Implemented in `gateway/` and `persistence/`."""

from __future__ import annotations

from typing import Protocol

from shougong.usecase.hanzihero.model import HanziHeroConnection


class IHanziHeroConnectionRepository(Protocol):
    async def get(self) -> HanziHeroConnection | None:
        """The single stored connection, or `None` before the first connect."""
        ...

    async def save(self, connection: HanziHeroConnection) -> None:
        """Upsert the single connection row."""
        ...


class IHanziHeroLoginGateway(Protocol):
    async def log_in(self, identifier: str, password: str) -> str:
        """Perform HanziHero's login handshake and return the authenticated session
        cookie as a `name=value` (or `name=value; name=value`) header string.

        Raises `HanziHeroAuthenticationError` when HanziHero rejects the
        credentials and `HanziHeroUnavailableError` on a transport or unexpected
        response failure.
        """
        ...
