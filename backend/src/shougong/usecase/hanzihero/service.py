"""`HanziHeroService` — connect an account, read the connection status, and sync.

The sync is additive and idempotent: it fetches all three exports before importing
anything, parses and dedupes them, then submits the rows through the study slice's
batch import under the `hanzihero` source. It never deletes or updates an existing
study item, so a re-sync only fills in what is missing.
"""

from __future__ import annotations

from dataclasses import replace
from itertools import batched

from shougong.usecase.commons.time import IClock
from shougong.usecase.configuration.transaction import ITransactionTemplate
from shougong.usecase.hanzihero.export import parse_exports
from shougong.usecase.hanzihero.gateway import (
    IBatchImporter,
    IHanziHeroConnectionRepository,
    IHanziHeroExportGateway,
    IHanziHeroLoginGateway,
)
from shougong.usecase.hanzihero.model import (
    HanziHeroConnection,
    HanziHeroNotConnectedError,
    HanziHeroStatus,
    HanziHeroSyncReport,
)
from shougong.usecase.study.model import (
    BATCH_IMPORT_LIMIT,
    BatchImportOutcome,
    BatchImportRow,
    ItemSource,
)


class HanziHeroService:
    def __init__(
        self,
        repository: IHanziHeroConnectionRepository,
        login_gateway: IHanziHeroLoginGateway,
        export_gateway: IHanziHeroExportGateway,
        batch_importer: IBatchImporter,
        clock: IClock,
        transaction_template: ITransactionTemplate,
    ) -> None:
        self._repository = repository
        self._login = login_gateway
        self._exports = export_gateway
        self._importer = batch_importer
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

    async def sync(self) -> HanziHeroSyncReport:
        """Import the learner's known HanziHero items as ordinary study items.

        All three exports are fetched before the first row is imported, so an
        expired session or a failed fetch aborts the run with nothing enqueued — a
        partial vocabulary is never imported, and `last_synced_at` does not advance.
        A successful run chunks the deduped rows at the batch-import limit, submits
        each chunk under the `hanzihero` source, renumbers the outcomes across the
        chunks and stamps `last_synced_at`.

        Raises:
            HanziHeroNotConnectedError: No HanziHero session is stored.
            HanziHeroSessionExpiredError: The stored session is stale.
            HanziHeroUnavailableError: A fetch failed.
        """
        connection = await self._repository.get()
        if connection is None:
            raise HanziHeroNotConnectedError("no HanziHero session is stored; connect first")

        exports = await self._exports.fetch_exports(connection.session_cookie)
        rows = parse_exports(exports)

        outcomes: list[BatchImportOutcome] = []
        for chunk in batched(rows, BATCH_IMPORT_LIMIT):
            report = await self._importer.import_batch(
                [BatchImportRow(hanzi=row.hanzi, pinyin=row.pinyin) for row in chunk],
                source=ItemSource.HANZIHERO,
            )
            outcomes.extend(report.outcomes)
        renumbered = tuple(replace(outcome, row=index) for index, outcome in enumerate(outcomes, start=1))

        synced_at = self._clock.now()
        await self._repository.save(replace(connection, last_synced_at=synced_at))
        return HanziHeroSyncReport(synced_at=synced_at, outcomes=renumbered)
