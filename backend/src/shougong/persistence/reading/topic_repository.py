"""`ReadingTopicRepository` — implements `IReadingTopicRepository` against MySQL."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import select

from shougong.persistence.configuration.transaction import (
    SqlAlchemyTransactionTemplate,
    current_session,
)
from shougong.persistence.reading.topic_entity import ReadingTopicEntity
from shougong.usecase.reading.gateway import IReadingTopicRepository
from shougong.usecase.reading.model import ReadingTopic


def _naive_utc(value: datetime) -> datetime:
    return value.astimezone(UTC).replace(tzinfo=None)


def to_domain(row: ReadingTopicEntity) -> ReadingTopic:
    return ReadingTopic(id=row.id, scenario=row.scenario, active=row.active)


class ReadingTopicRepository(IReadingTopicRepository):
    def __init__(self, transaction_template: SqlAlchemyTransactionTemplate) -> None:
        self._tx = transaction_template

    async def list_active(self) -> list[str]:
        async def _run() -> list[str]:
            session = current_session()
            stmt = select(ReadingTopicEntity.scenario).where(ReadingTopicEntity.active.is_(True))
            return list((await session.execute(stmt)).scalars().all())

        return await self._tx.execute(_run)

    async def list_all(self) -> list[ReadingTopic]:
        async def _run() -> list[ReadingTopic]:
            session = current_session()
            stmt = select(ReadingTopicEntity).order_by(ReadingTopicEntity.created_at, ReadingTopicEntity.id)
            rows = (await session.execute(stmt)).scalars().all()
            return [to_domain(row) for row in rows]

        return await self._tx.execute(_run)

    async def add(self, scenario: str, created_at: datetime) -> ReadingTopic:
        async def _run() -> ReadingTopic:
            session = current_session()
            row = ReadingTopicEntity(scenario=scenario, active=True, created_at=_naive_utc(created_at))
            session.add(row)
            await session.flush()
            return to_domain(row)

        return await self._tx.execute(_run)

    async def set_active(self, topic_id: int, active: bool) -> ReadingTopic | None:
        async def _run() -> ReadingTopic | None:
            session = current_session()
            row = await session.get(ReadingTopicEntity, topic_id)
            if row is None:
                return None
            row.active = active
            return to_domain(row)

        return await self._tx.execute(_run)

    async def delete(self, topic_id: int) -> None:
        async def _run() -> None:
            session = current_session()
            row = await session.get(ReadingTopicEntity, topic_id)
            if row is not None:
                await session.delete(row)

        return await self._tx.execute(_run)
