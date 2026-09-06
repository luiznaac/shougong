"""`DictionaryRepository` — implements `IDictionaryRepository` against MySQL.

Each method runs inside `transaction_template.execute(...)` and reads the
session bound to that transaction via `current_session()`.
"""

from __future__ import annotations

from collections.abc import Sequence

from sqlalchemy import func, insert, or_, select

from shougong.persistence.configuration.transaction import (
    SqlAlchemyTransactionTemplate,
    current_session,
)
from shougong.persistence.dictionary.entity import DictionaryEntryEntity
from shougong.usecase.dictionary.gateway import IDictionaryRepository
from shougong.usecase.dictionary.model import CedictRecord, DictionaryEntry

_BULK_BATCH = 1000


def to_domain(row: DictionaryEntryEntity) -> DictionaryEntry:
    return DictionaryEntry(
        id=row.id,
        simplified=row.simplified,
        pinyin=row.pinyin,
        definitions=tuple(row.definitions),
    )


class DictionaryRepository(IDictionaryRepository):
    def __init__(self, transaction_template: SqlAlchemyTransactionTemplate) -> None:
        self._tx = transaction_template

    async def search(self, query: str, limit: int) -> list[DictionaryEntry]:
        async def _run() -> list[DictionaryEntry]:
            session = current_session()
            pattern = f"%{query}%"
            stmt = (
                select(DictionaryEntryEntity)
                .where(
                    or_(
                        DictionaryEntryEntity.simplified.like(pattern),
                        DictionaryEntryEntity.pinyin.like(pattern),
                    )
                )
                .order_by(
                    func.char_length(DictionaryEntryEntity.simplified),
                    DictionaryEntryEntity.id,
                )
                .limit(limit)
            )
            rows = (await session.execute(stmt)).scalars().all()
            return [to_domain(row) for row in rows]

        return await self._tx.execute(_run)

    async def find_by_simplified(self, simplified: str) -> list[DictionaryEntry]:
        async def _run() -> list[DictionaryEntry]:
            session = current_session()
            stmt = (
                select(DictionaryEntryEntity)
                .where(DictionaryEntryEntity.simplified == simplified)
                .order_by(DictionaryEntryEntity.id)
            )
            rows = (await session.execute(stmt)).scalars().all()
            return [to_domain(row) for row in rows]

        return await self._tx.execute(_run)

    async def find_by_simplified_many(self, simplified_words: Sequence[str]) -> list[DictionaryEntry]:
        async def _run() -> list[DictionaryEntry]:
            if not simplified_words:
                return []
            session = current_session()
            stmt = (
                select(DictionaryEntryEntity)
                .where(DictionaryEntryEntity.simplified.in_(simplified_words))
                .order_by(DictionaryEntryEntity.id)
            )
            rows = (await session.execute(stmt)).scalars().all()
            return [to_domain(row) for row in rows]

        return await self._tx.execute(_run)

    async def get(self, entry_id: int) -> DictionaryEntry | None:
        async def _run() -> DictionaryEntry | None:
            session = current_session()
            row = await session.get(DictionaryEntryEntity, entry_id)
            return to_domain(row) if row is not None else None

        return await self._tx.execute(_run)

    async def count(self) -> int:
        async def _run() -> int:
            session = current_session()
            total = await session.scalar(select(func.count()).select_from(DictionaryEntryEntity))
            return int(total or 0)

        return await self._tx.execute(_run)

    async def bulk_add(self, records: Sequence[CedictRecord]) -> int:
        async def _run() -> int:
            session = current_session()
            added = 0
            for start in range(0, len(records), _BULK_BATCH):
                batch = records[start : start + _BULK_BATCH]
                await session.execute(
                    insert(DictionaryEntryEntity),
                    [
                        {
                            "simplified": r.simplified,
                            "pinyin": r.pinyin,
                            "definitions": list(r.definitions),
                        }
                        for r in batch
                    ],
                )
                added += len(batch)
            return added

        return await self._tx.execute(_run)
