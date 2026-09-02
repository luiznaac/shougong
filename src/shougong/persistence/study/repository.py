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
from shougong.persistence.study.entity import ReviewLogEntity, StudyItemEntity, StudyItemHistoryEntity
from shougong.usecase.commons.exceptions import ResourceNotFoundError
from shougong.usecase.dictionary.model import DictionaryEntry
from shougong.usecase.srs.model import SrsCard, SrsRating, SrsReviewLog, SrsState
from shougong.usecase.study.gateway import IStudyItemRepository
from shougong.usecase.study.model import StudyItem, StudyItemHistory


def _naive_utc(value: datetime) -> datetime:
    return value.astimezone(UTC).replace(tzinfo=None)


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def _card_of(row: StudyItemEntity | StudyItemHistoryEntity) -> SrsCard:
    return SrsCard(
        state=SrsState(row.card_state),
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


def _history_to_domain(row: StudyItemHistoryEntity, entry: DictionaryEntryEntity) -> StudyItemHistory:
    return StudyItemHistory(
        study_item_id=row.study_item_id,
        entry=_entry_to_domain(entry),
        card=_card_of(row),
        created_at=_as_utc(row.created_at),  # type: ignore[arg-type]  # column is NOT NULL
    )


def _history_of(row: StudyItemEntity, created_at: datetime) -> StudyItemHistoryEntity:
    return StudyItemHistoryEntity(
        study_item_id=row.id,
        created_at=_naive_utc(created_at),
        entry_id=row.entry_id,
        card_state=row.card_state,
        card_stability=row.card_stability,
        card_difficulty=row.card_difficulty,
        card_due=row.card_due,
        card_last_review=row.card_last_review,
    )


class StudyItemRepository(IStudyItemRepository):
    def __init__(self, transaction_template: SqlAlchemyTransactionTemplate) -> None:
        self._tx = transaction_template

    async def create(self, entry: DictionaryEntry, card: SrsCard, created_at: datetime) -> StudyItem:
        async def _run() -> StudyItem:
            session = current_session()
            row = StudyItemEntity(
                entry_id=entry.id,
                card_state=int(card.state),
                card_stability=card.stability,
                card_difficulty=card.difficulty,
                card_due=_naive_utc(card.due),
                card_last_review=_naive_utc(card.last_review) if card.last_review else None,
                created_at=_naive_utc(created_at),
            )
            session.add(row)
            await session.flush()
            session.add(_history_of(row, created_at))
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

    async def update_card(self, item_id: int, card: SrsCard, changed_at: datetime) -> StudyItem:
        async def _run() -> StudyItem:
            session = current_session()
            row = await session.get(StudyItemEntity, item_id)
            if row is None:
                raise ResourceNotFoundError("study_item", str(item_id))
            row.card_state = int(card.state)
            row.card_stability = card.stability
            row.card_difficulty = card.difficulty
            row.card_due = _naive_utc(card.due)
            row.card_last_review = _naive_utc(card.last_review) if card.last_review else None
            await session.flush()
            session.add(_history_of(row, changed_at))
            await session.flush()
            entry = await session.get(DictionaryEntryEntity, row.entry_id)
            assert entry is not None  # entry_id is a NOT NULL foreign key
            return _to_domain(row, entry)

        return await self._tx.execute(_run)

    async def add_review_log(self, item_id: int, log: SrsReviewLog) -> None:
        async def _run() -> None:
            session = current_session()
            session.add(
                ReviewLogEntity(
                    study_item_id=item_id,
                    rating=int(log.rating),
                    review_datetime=_naive_utc(log.review_datetime),
                )
            )
            await session.flush()

        await self._tx.execute(_run)

    async def list_reviews(self, item_id: int, *, limit: int, offset: int) -> list[SrsReviewLog]:
        async def _run() -> list[SrsReviewLog]:
            session = current_session()
            stmt = (
                select(ReviewLogEntity)
                .where(ReviewLogEntity.study_item_id == item_id)
                .order_by(ReviewLogEntity.review_datetime.desc(), ReviewLogEntity.id.desc())
                .limit(limit)
                .offset(offset)
            )
            rows = (await session.execute(stmt)).scalars().all()
            return [
                SrsReviewLog(rating=SrsRating(row.rating), review_datetime=_as_utc(row.review_datetime))  # type: ignore[arg-type]  # column is NOT NULL
                for row in rows
            ]

        return await self._tx.execute(_run)

    async def list_history(self, item_id: int, *, limit: int, offset: int) -> list[StudyItemHistory]:
        async def _run() -> list[StudyItemHistory]:
            session = current_session()
            stmt = (
                select(StudyItemHistoryEntity, DictionaryEntryEntity)
                .join(DictionaryEntryEntity, StudyItemHistoryEntity.entry_id == DictionaryEntryEntity.id)
                .where(StudyItemHistoryEntity.study_item_id == item_id)
                .order_by(StudyItemHistoryEntity.created_at.desc(), StudyItemHistoryEntity.id.desc())
                .limit(limit)
                .offset(offset)
            )
            rows = (await session.execute(stmt)).all()
            return [_history_to_domain(history, entry) for history, entry in rows]

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
