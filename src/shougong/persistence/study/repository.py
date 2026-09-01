"""`StudyItemRepository` — implements `IStudyItemRepository` against MySQL."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import exists, select

from shougong.persistence.configuration.transaction import (
    SqlAlchemyTransactionTemplate,
    current_session,
)
from shougong.persistence.dictionary.entity import DictionaryEntryEntity
from shougong.persistence.dictionary.repository import to_domain as _entry_to_domain
from shougong.persistence.study.entity import StudyItemEntity
from shougong.usecase.dictionary.model import DictionaryEntry
from shougong.usecase.srs.model import SrsCard, SrsState
from shougong.usecase.study.model import StudyItem


def _naive_utc(value: datetime) -> datetime:
    return value.astimezone(UTC).replace(tzinfo=None)


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def _card_of(row: StudyItemEntity) -> SrsCard:
    return SrsCard(
        state=SrsState(row.card_state),
        step=row.card_step,
        stability=row.card_stability,
        difficulty=row.card_difficulty,
        due=_as_utc(row.card_due),  # type: ignore[arg-type]  # column is NOT NULL
        last_review=_as_utc(row.card_last_review),
    )


def _to_domain(row: StudyItemEntity, entry: DictionaryEntryEntity) -> StudyItem:
    return StudyItem(
        id=row.id,
        entry=_entry_to_domain(entry),
        card=_card_of(row),
        created_at=_as_utc(row.created_at),  # type: ignore[arg-type]  # column is NOT NULL
    )


class StudyItemRepository:
    def __init__(self, transaction_template: SqlAlchemyTransactionTemplate) -> None:
        self._tx = transaction_template

    async def create(self, entry: DictionaryEntry, card: SrsCard, created_at: datetime) -> StudyItem:
        async def _run() -> StudyItem:
            session = current_session()
            row = StudyItemEntity(
                entry_id=entry.id,
                card_state=int(card.state),
                card_step=card.step,
                card_stability=card.stability,
                card_difficulty=card.difficulty,
                card_due=_naive_utc(card.due),
                card_last_review=_naive_utc(card.last_review) if card.last_review else None,
                created_at=_naive_utc(created_at),
            )
            session.add(row)
            await session.flush()
            return StudyItem(id=row.id, entry=entry, card=card, created_at=created_at)

        return await self._tx.execute(_run)

    async def get(self, item_id: int) -> StudyItem | None:
        async def _run() -> StudyItem | None:
            session = current_session()
            stmt = (
                select(StudyItemEntity, DictionaryEntryEntity)
                .join(DictionaryEntryEntity, StudyItemEntity.entry_id == DictionaryEntryEntity.id)
                .where(StudyItemEntity.id == item_id)
            )
            result = (await session.execute(stmt)).first()
            return _to_domain(*result) if result is not None else None

        return await self._tx.execute(_run)

    async def exists_for_entry(self, entry_id: int) -> bool:
        async def _run() -> bool:
            session = current_session()
            found = await session.scalar(select(exists().where(StudyItemEntity.entry_id == entry_id)))
            return bool(found)

        return await self._tx.execute(_run)

    async def list(self, *, due_before: datetime | None, limit: int, offset: int) -> list[StudyItem]:
        async def _run() -> list[StudyItem]:
            session = current_session()
            stmt = select(StudyItemEntity, DictionaryEntryEntity).join(
                DictionaryEntryEntity, StudyItemEntity.entry_id == DictionaryEntryEntity.id
            )
            if due_before is not None:
                stmt = stmt.where(StudyItemEntity.card_due <= _naive_utc(due_before))
            stmt = stmt.order_by(StudyItemEntity.card_due, StudyItemEntity.id).limit(limit).offset(offset)
            rows = (await session.execute(stmt)).all()
            return [_to_domain(item, entry) for item, entry in rows]

        return await self._tx.execute(_run)
