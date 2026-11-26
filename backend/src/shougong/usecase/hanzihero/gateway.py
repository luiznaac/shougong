"""Ports of the HanziHero slice — outbound adapters live in `gateway/` and `persistence/`.

`IBatchImporter` is the inbound collaboration seam the sync consumes; `StudyService`
satisfies it structurally.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol

from shougong.usecase.hanzihero.model import HanziHeroConnection, HanziHeroExports
from shougong.usecase.study.model import (
    BatchImportReport,
    BatchImportRow,
    ItemSource,
)


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


class IHanziHeroExportGateway(Protocol):
    async def fetch_exports(self, session_cookie: str) -> HanziHeroExports:
        """Fetch all three simplified-course exports before anything is imported.

        Raises `HanziHeroSessionExpiredError` when HanziHero answers with its login
        redirect (the stored session is stale) and `HanziHeroUnavailableError` on a
        transport or unexpected response failure. Either raise aborts the run with
        nothing imported.
        """
        ...


class IBatchImporter(Protocol):
    """The study slice's batch-import seam, consumed structurally by the sync.

    `StudyService` satisfies this without importing back into the hanzihero slice;
    a test double records the chunks the sync submits.
    """

    async def import_batch(
        self, rows: Sequence[BatchImportRow], *, source: ItemSource = ItemSource.IMPORT
    ) -> BatchImportReport:
        """Resolve and enqueue the rows, reporting one outcome per row."""
        ...
