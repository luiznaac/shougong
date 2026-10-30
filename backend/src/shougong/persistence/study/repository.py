"""`StudyItemRepository` — implements `IStudyItemRepository` against MySQL."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import Select, delete, exists, select
from sqlalchemy.ext.asyncio import AsyncSession

from shougong.persistence.configuration.transaction import (
    SqlAlchemyTransactionTemplate,
    current_session,
)
from shougong.persistence.dictionary.entity import DictionaryEntryEntity
from shougong.persistence.dictionary.repository import to_domain as _entry_to_domain
from shougong.persistence.study.entity import ReviewLogEntity, StudyItemEntity, StudyItemPriorityEntity
from shougong.usecase.commons.exceptions import ResourceNotFoundError
from shougong.usecase.dictionary.model import DictionaryEntry
from shougong.usecase.srs.model import SrsCard, SrsRating, SrsReviewLog, SrsState
from shougong.usecase.study.gateway import IStudyItemRepository
from shougong.usecase.study.model import PriorityEdge, SessionKind, StudyItem
from shougong.usecase.study_item_history.gateway import IStudyItemHistoryRepository


def _naive_utc(value: datetime) -> datetime:
    return value.astimezone(UTC).replace(tzinfo=None)


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def _card_of(row: StudyItemEntity) -> SrsCard:
    return SrsCard(
        state=SrsState(row.card_state),
        stability=row.card_stability,
        difficulty=row.card_difficulty,
        due=_as_utc(row.card_due),  # type: ignore[arg-type]  # column is NOT NULL
        last_review=_as_utc(row.card_last_review),
    )


def _to_domain(row: StudyItemEntity, entry: DictionaryEntryEntity, priority_position: int | None) -> StudyItem:
    return StudyItem(
        id=row.id,
        entry=_entry_to_domain(entry),
        card=_card_of(row),
        created_at=_as_utc(row.created_at),  # type: ignore[arg-type]  # column is NOT NULL
        priority_position=priority_position,
    )


def _with_priority_and_entry() -> Select[tuple[StudyItemEntity, DictionaryEntryEntity, int]]:
    return (
        select(StudyItemEntity, DictionaryEntryEntity, StudyItemPriorityEntity.position)
        .join(DictionaryEntryEntity, StudyItemEntity.entry_id == DictionaryEntryEntity.id)
        .outerjoin(StudyItemPriorityEntity, StudyItemPriorityEntity.study_item_id == StudyItemEntity.id)
    )


class StudyItemRepository(IStudyItemRepository):
    def __init__(
        self,
        transaction_template: SqlAlchemyTransactionTemplate,
        history_repository: IStudyItemHistoryRepository,
    ) -> None:
        self._tx = transaction_template
        self._history = history_repository

    async def _fetch(self, session: AsyncSession, item_id: int) -> StudyItem:
        result = (await session.execute(_with_priority_and_entry().where(StudyItemEntity.id == item_id))).first()
        if result is None:
            raise ResourceNotFoundError("study_item", str(item_id))
        return _to_domain(*result)

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
            item = StudyItem(id=row.id, entry=entry, card=card, created_at=created_at)
            await self._history.record(item, created_at)
            return item

        return await self._tx.execute(_run)

    async def get(self, item_id: int) -> StudyItem | None:
        async def _run() -> StudyItem | None:
            session = current_session()
            result = (await session.execute(_with_priority_and_entry().where(StudyItemEntity.id == item_id))).first()
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
            graduated = SrsState(row.card_state) is SrsState.LEARNING and card.state is not SrsState.LEARNING
            row.card_state = int(card.state)
            row.card_stability = card.stability
            row.card_difficulty = card.difficulty
            row.card_due = _naive_utc(card.due)
            row.card_last_review = _naive_utc(card.last_review) if card.last_review else None
            if graduated:
                # Priority is learning-only; the pin dies with the graduation, in
                # the same transaction as the card update.
                await session.execute(
                    delete(StudyItemPriorityEntity).where(StudyItemPriorityEntity.study_item_id == item_id)
                )
            await session.flush()
            updated = await self._fetch(session, item_id)
            await self._history.record(updated, changed_at)
            return updated

        return await self._tx.execute(_run)

    async def prioritise(self, item_id: int, edge: PriorityEdge) -> StudyItem:
        async def _run() -> StudyItem:
            session = current_session()
            edge_stmt = select(StudyItemPriorityEntity.position)
            if edge is PriorityEdge.FRONT:
                edge_stmt = edge_stmt.order_by(
                    StudyItemPriorityEntity.position.asc(), StudyItemPriorityEntity.study_item_id.asc()
                )
            else:
                edge_stmt = edge_stmt.order_by(
                    StudyItemPriorityEntity.position.desc(), StudyItemPriorityEntity.study_item_id.desc()
                )
            extreme = await session.scalar(edge_stmt.limit(1).with_for_update())
            if extreme is None:
                position = 0
            elif edge is PriorityEdge.FRONT:
                position = extreme - 1
            else:
                position = extreme + 1

            row = await session.get(StudyItemPriorityEntity, item_id, with_for_update=True)
            if row is None:
                session.add(StudyItemPriorityEntity(study_item_id=item_id, position=position))
            else:
                row.position = position
            await session.flush()
            return await self._fetch(session, item_id)

        return await self._tx.execute(_run)

    async def deprioritise(self, item_id: int) -> None:
        async def _run() -> None:
            session = current_session()
            await session.execute(
                delete(StudyItemPriorityEntity).where(StudyItemPriorityEntity.study_item_id == item_id)
            )
            await session.flush()

        await self._tx.execute(_run)

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

    async def list_known_entries(self) -> list[DictionaryEntry]:
        async def _run() -> list[DictionaryEntry]:
            session = current_session()
            stmt = select(DictionaryEntryEntity).join(
                StudyItemEntity, StudyItemEntity.entry_id == DictionaryEntryEntity.id
            )
            rows = (await session.execute(stmt)).scalars().all()
            return [_entry_to_domain(row) for row in rows]

        return await self._tx.execute(_run)

    async def list_for_session(self, kind: SessionKind, *, now: datetime) -> list[StudyItem]:
        async def _run() -> list[StudyItem]:
            session = current_session()
            stmt = _with_priority_and_entry()
            if kind is SessionKind.LESSON:
                stmt = stmt.where(StudyItemEntity.card_state == int(SrsState.LEARNING)).order_by(
                    StudyItemPriorityEntity.position.is_(None),
                    StudyItemPriorityEntity.position,
                    StudyItemEntity.id,
                )
            else:
                stmt = stmt.where(
                    StudyItemEntity.card_state != int(SrsState.LEARNING),
                    StudyItemEntity.card_due <= _naive_utc(now),
                ).order_by(StudyItemEntity.card_due, StudyItemEntity.id)
            rows = (await session.execute(stmt)).all()
            return [_to_domain(item, entry, position) for item, entry, position in rows]

        return await self._tx.execute(_run)

    # NOTE: keep this method last — see the matching note on the port in
    # usecase/study/gateway.py (its name shadows the builtin `list` for any
    # annotation written after it in this class body).
    async def list(self, *, due_before: datetime | None, limit: int, offset: int) -> list[StudyItem]:
        async def _run() -> list[StudyItem]:
            session = current_session()
            stmt = _with_priority_and_entry()
            if due_before is not None:
                stmt = stmt.where(StudyItemEntity.card_due <= _naive_utc(due_before))
            stmt = stmt.order_by(StudyItemEntity.card_due, StudyItemEntity.id).limit(limit).offset(offset)
            rows = (await session.execute(stmt)).all()
            return [_to_domain(item, entry, position) for item, entry, position in rows]

        return await self._tx.execute(_run)
