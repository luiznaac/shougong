"""`VocabularyProfileRepository` — implements `IVocabularyProfileRepository` against MySQL."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import UTC, datetime

from sqlalchemy import select

from shougong.persistence.configuration.transaction import (
    SqlAlchemyTransactionTemplate,
    current_session,
)
from shougong.persistence.reading.vocabulary_profile_entity import VocabularyProfileEntity
from shougong.usecase.reading.gateway import IVocabularyProfileRepository
from shougong.usecase.reading.vocabulary import ProfileSource, VocabularyCategory, VocabularyProfile


def _naive_utc(value: datetime) -> datetime:
    return value.astimezone(UTC).replace(tzinfo=None)


def to_domain(row: VocabularyProfileEntity) -> VocabularyProfile:
    return VocabularyProfile(
        simplified=row.simplified,
        hsk_level=row.hsk_level,
        pos_tags=tuple(row.pos_tags),
        pos_category=VocabularyCategory(row.pos_category),
        source=ProfileSource(row.source),
    )


class VocabularyProfileRepository(IVocabularyProfileRepository):
    def __init__(self, transaction_template: SqlAlchemyTransactionTemplate) -> None:
        self._tx = transaction_template

    async def list_all(self) -> list[VocabularyProfile]:
        async def _run() -> list[VocabularyProfile]:
            session = current_session()
            stmt = select(VocabularyProfileEntity).order_by(VocabularyProfileEntity.simplified)
            rows = (await session.execute(stmt)).scalars().all()
            return [to_domain(row) for row in rows]

        return await self._tx.execute(_run)

    async def upsert_many(self, profiles: Sequence[VocabularyProfile], updated_at: datetime) -> None:
        async def _run() -> None:
            session = current_session()
            now = _naive_utc(updated_at)
            for profile in profiles:
                await session.merge(
                    VocabularyProfileEntity(
                        simplified=profile.simplified,
                        hsk_level=profile.hsk_level,
                        pos_tags=list(profile.pos_tags),
                        pos_category=profile.pos_category.value,
                        source=profile.source.value,
                        updated_at=now,
                    )
                )

        return await self._tx.execute(_run)

    async def get(self, simplified: str) -> VocabularyProfile | None:
        async def _run() -> VocabularyProfile | None:
            session = current_session()
            row = await session.get(VocabularyProfileEntity, simplified)
            return to_domain(row) if row is not None else None

        return await self._tx.execute(_run)
