"""`StudyItemHistoryRepository` — implements `IStudyItemHistoryRepository` against MySQL."""

from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import func, select

from shougong.persistence.configuration.transaction import SqlAlchemyTransactionTemplate, current_session
from shougong.persistence.dictionary.entity import DictionaryEntryEntity
from shougong.persistence.dictionary.repository import to_domain as _entry_to_domain
from shougong.persistence.study_item_history.entity import StudyItemHistoryEntity
from shougong.usecase.srs.model import SrsCard, SrsState
from shougong.usecase.study.model import StudyItem
from shougong.usecase.study_item_history.gateway import IStudyItemHistoryRepository
from shougong.usecase.study_item_history.model import StudyItemHistory


def _naive_utc(value: datetime) -> datetime:
    return value.astimezone(UTC).replace(tzinfo=None)


def _as_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def _to_domain(row: StudyItemHistoryEntity, entry: DictionaryEntryEntity) -> StudyItemHistory:
    return StudyItemHistory(
        study_item_id=row.study_item_id,
        entry=_entry_to_domain(entry),
        card=SrsCard(
            state=SrsState(row.card_state),
            stability=row.card_stability,
            difficulty=row.card_difficulty,
            due=_as_utc(row.card_due),  # type: ignore[arg-type]  # column is NOT NULL
            last_review=_as_utc(row.card_last_review),
        ),
        created_at=_as_utc(row.created_at),  # type: ignore[arg-type]  # column is NOT NULL
    )


class StudyItemHistoryRepository(IStudyItemHistoryRepository):
    def __init__(self, transaction_template: SqlAlchemyTransactionTemplate) -> None:
        self._tx = transaction_template

    async def record(self, item: StudyItem, recorded_at: datetime) -> None:
        async def _run() -> None:
            session = current_session()
            card = item.card
            session.add(
                StudyItemHistoryEntity(
                    study_item_id=item.id,
                    created_at=_naive_utc(recorded_at),
                    entry_id=item.entry.id,
                    card_state=int(card.state),
                    card_stability=card.stability,
                    card_difficulty=card.difficulty,
                    card_due=_naive_utc(card.due),
                    card_last_review=_naive_utc(card.last_review) if card.last_review else None,
                )
            )
            await session.flush()

        await self._tx.execute(_run)

    async def list_for_item(self, item_id: int, *, limit: int, offset: int) -> list[StudyItemHistory]:
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
            return [_to_domain(history, entry) for history, entry in rows]

        return await self._tx.execute(_run)

    async def list_learning_to_review_transitions(self, *, limit: int, offset: int) -> list[StudyItemHistory]:
        async def _run() -> list[StudyItemHistory]:
            session = current_session()
            history = StudyItemHistoryEntity
            # LAG gives each history row the state of the item's previous row, in trail order.
            previous_state = func.lag(history.card_state).over(
                partition_by=history.study_item_id,
                order_by=(history.created_at.asc(), history.id.asc()),
            )
            ranked = select(
                history.id.label("history_id"),
                history.card_state.label("state"),
                previous_state.label("previous_state"),
            ).subquery()
            transition_ids = select(ranked.c.history_id).where(
                ranked.c.state == int(SrsState.REVIEW),
                ranked.c.previous_state == int(SrsState.LEARNING),
            )
            stmt = (
                select(StudyItemHistoryEntity, DictionaryEntryEntity)
                .join(DictionaryEntryEntity, StudyItemHistoryEntity.entry_id == DictionaryEntryEntity.id)
                .where(StudyItemHistoryEntity.id.in_(transition_ids))
                .order_by(StudyItemHistoryEntity.created_at.desc(), StudyItemHistoryEntity.id.desc())
                .limit(limit)
                .offset(offset)
            )
            rows = (await session.execute(stmt)).all()
            return [_to_domain(history_row, entry) for history_row, entry in rows]

        return await self._tx.execute(_run)
