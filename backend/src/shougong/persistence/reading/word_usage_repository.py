"""`ReadingWordUsageRepository` — implements `IReadingWordUsageRepository` against MySQL."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime

from sqlalchemy import select

from shougong.persistence.configuration.transaction import (
    SqlAlchemyTransactionTemplate,
    current_session,
)
from shougong.persistence.reading.word_usage_entity import ReadingWordUsageEntity
from shougong.usecase.reading.gateway import IReadingWordUsageRepository
from shougong.usecase.reading.working_set import WordUsage


def _naive_utc(value: datetime) -> datetime:
    return value.astimezone(UTC).replace(tzinfo=None)


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


class ReadingWordUsageRepository(IReadingWordUsageRepository):
    def __init__(self, transaction_template: SqlAlchemyTransactionTemplate) -> None:
        self._tx = transaction_template

    async def load(self, words: Sequence[str]) -> dict[str, WordUsage]:
        async def _run() -> dict[str, WordUsage]:
            if not words:
                return {}
            session = current_session()
            stmt = select(ReadingWordUsageEntity).where(ReadingWordUsageEntity.simplified.in_(words))
            rows = (await session.execute(stmt)).scalars().all()
            return {row.simplified: WordUsage(uses=row.uses, last_used_at=_as_utc(row.last_used_at)) for row in rows}

        return await self._tx.execute(_run)

    async def record(self, words: Sequence[str], at: datetime) -> None:
        async def _run() -> None:
            if not words:
                return
            session = current_session()
            now = _naive_utc(at)
            existing = {
                row.simplified: row
                for row in (
                    await session.execute(
                        select(ReadingWordUsageEntity).where(ReadingWordUsageEntity.simplified.in_(words))
                    )
                )
                .scalars()
                .all()
            }
            for word in words:
                row = existing.get(word)
                if row is None:
                    session.add(ReadingWordUsageEntity(simplified=word, uses=1, last_used_at=now))
                else:
                    row.uses += 1
                    row.last_used_at = now

        return await self._tx.execute(_run)
