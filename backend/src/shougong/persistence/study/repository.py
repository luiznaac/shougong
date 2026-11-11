"""`StudyItemRepository` — implements `IStudyItemRepository` against MySQL."""

from __future__ import annotations

import json
from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import Select, case, delete, exists, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.selectable import Subquery

from shougong.persistence.configuration.time import as_utc as _as_utc
from shougong.persistence.configuration.time import naive_utc as _naive_utc
from shougong.persistence.configuration.transaction import (
    SqlAlchemyTransactionTemplate,
    current_session,
)
from shougong.persistence.dictionary.entity import DictionaryEntryEntity
from shougong.persistence.dictionary.repository import to_domain as _entry_to_domain
from shougong.persistence.study.entity import ReviewLogEntity, StudyItemEntity, StudyItemPriorityEntity
from shougong.usecase.commons.exceptions import ResourceNotFoundError
from shougong.usecase.commons.page import Page
from shougong.usecase.dictionary.model import DictionaryEntry
from shougong.usecase.insights.policy import THRESHOLD, WINDOW_SIZE
from shougong.usecase.srs.model import SrsCard, SrsRating, SrsReviewLog, SrsState
from shougong.usecase.study.gateway import IStudyItemRepository
from shougong.usecase.study.model import PriorityEdge, SessionKind, StudyItem, StudyItemFilters, StudyItemSort
from shougong.usecase.study_item_history.gateway import IStudyItemHistoryRepository


def _card_of(row: StudyItemEntity) -> SrsCard:
    return SrsCard(
        state=SrsState(row.card_state),
        stability=row.card_stability,
        difficulty=row.card_difficulty,
        due=_as_utc(row.card_due),
        last_review=_as_utc(row.card_last_review),
    )


def to_domain(
    row: StudyItemEntity,
    entry: DictionaryEntryEntity,
    priority_position: int | None = None,
) -> StudyItem:
    """Map a joined `study_item` + `dictionary_entry` row to the domain item.

    Shared with the insights adapter, which reads the same item shape; the
    priority position is optional so a read that does not join the pin table
    can still use it.
    """
    return StudyItem(
        id=row.id,
        entry=_entry_to_domain(entry),
        card=_card_of(row),
        created_at=_as_utc(row.created_at),
        priority_position=priority_position,
    )


def _with_priority_and_entry() -> Select[tuple[StudyItemEntity, DictionaryEntryEntity, int]]:
    return (
        select(StudyItemEntity, DictionaryEntryEntity, StudyItemPriorityEntity.position)
        .join(DictionaryEntryEntity, StudyItemEntity.entry_id == DictionaryEntryEntity.id)
        .outerjoin(StudyItemPriorityEntity, StudyItemPriorityEntity.study_item_id == StudyItemEntity.id)
    )


def _leech_stats() -> Subquery:
    """The leech set with its worst-first ordering keys, in one read.

    The window and threshold come from the insight policy, so the rule's constants
    live in one place; the integration suite pins this SQL result against the
    derived `is_leech` flag over the same seed.
    """
    ranked = select(
        ReviewLogEntity.study_item_id.label("item_id"),
        ReviewLogEntity.rating.label("rating"),
        ReviewLogEntity.review_datetime.label("review_datetime"),
        func.row_number()
        .over(
            partition_by=ReviewLogEntity.study_item_id,
            order_by=(ReviewLogEntity.review_datetime.desc(), ReviewLogEntity.id.desc()),
        )
        .label("position"),
    ).subquery()
    again = ranked.c.rating == int(SrsRating.AGAIN)
    failures = func.sum(case((again, 1), else_=0))
    return (
        select(
            ranked.c.item_id,
            failures.label("failure_count"),
            func.max(case((again, ranked.c.review_datetime))).label("latest_failure"),
        )
        .where(ranked.c.position <= WINDOW_SIZE)
        .group_by(ranked.c.item_id)
        .having(failures >= THRESHOLD)
        .subquery()
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
        return to_domain(*result)

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
            return to_domain(*result) if result is not None else None

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
                SrsReviewLog(rating=SrsRating(row.rating), review_datetime=_as_utc(row.review_datetime)) for row in rows
            ]

        return await self._tx.execute(_run)

    async def get_many(self, item_ids: Sequence[int]) -> list[StudyItem]:
        if not item_ids:
            return []

        async def _run() -> list[StudyItem]:
            session = current_session()
            stmt = _with_priority_and_entry().where(StudyItemEntity.id.in_(item_ids))
            rows = (await session.execute(stmt)).all()
            return [to_domain(item, entry, position) for item, entry, position in rows]

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
            return [to_domain(item, entry, position) for item, entry, position in rows]

        return await self._tx.execute(_run)

    # NOTE: keep this method last — see the matching note on the port in
    # usecase/study/gateway.py (its name shadows the builtin `list` for any
    # annotation written after it in this class body).
    async def list(self, filters: StudyItemFilters, *, limit: int, offset: int) -> Page[StudyItem]:
        async def _run() -> Page[StudyItem]:
            session = current_session()
            stmt = _with_priority_and_entry()
            leech = _leech_stats() if filters.leech else None
            if leech is not None:
                stmt = stmt.join(leech, leech.c.item_id == StudyItemEntity.id)

            predicates = []
            if filters.due_from is not None:
                predicates.append(StudyItemEntity.card_due >= _naive_utc(filters.due_from))
            if filters.due_to is not None:
                predicates.append(StudyItemEntity.card_due < _naive_utc(filters.due_to))
            if filters.states:
                predicates.append(StudyItemEntity.card_state.in_([int(state) for state in filters.states]))
            if filters.hsk_levels:
                levels = [level for level in filters.hsk_levels if level is not None]
                level_predicates = []
                if levels:
                    level_predicates.append(DictionaryEntryEntity.hsk_level.in_(levels))
                if None in filters.hsk_levels:
                    level_predicates.append(DictionaryEntryEntity.hsk_level.is_(None))
                predicates.append(or_(*level_predicates))
            if filters.pos_tags:
                predicates.append(
                    func.json_overlaps(
                        DictionaryEntryEntity.pos_tags,
                        json.dumps(list(filters.pos_tags)),
                    )
                )
            if filters.search is not None:
                pattern = f"%{filters.search}%"
                predicates.append(
                    or_(
                        DictionaryEntryEntity.simplified.ilike(pattern),
                        DictionaryEntryEntity.pinyin.ilike(pattern),
                    )
                )
            if predicates:
                stmt = stmt.where(*predicates)

            total = await session.scalar(select(func.count()).select_from(stmt.subquery()))

            if leech is not None and filters.sort is None:
                stmt = stmt.order_by(
                    leech.c.failure_count.desc(),
                    leech.c.latest_failure.desc(),
                    StudyItemEntity.id.asc(),
                )
            else:
                sort = filters.sort or StudyItemSort.DUE_ASC
                if sort is StudyItemSort.CREATED_DESC:
                    stmt = stmt.order_by(StudyItemEntity.created_at.desc(), StudyItemEntity.id.desc())
                elif sort is StudyItemSort.STABILITY_ASC:
                    stmt = stmt.order_by(
                        StudyItemEntity.card_stability.is_(None),
                        StudyItemEntity.card_stability.asc(),
                        StudyItemEntity.id.asc(),
                    )
                else:
                    stmt = stmt.order_by(StudyItemEntity.card_due.asc(), StudyItemEntity.id.asc())
            rows = (await session.execute(stmt.limit(limit).offset(offset))).all()
            return Page(
                items=tuple(to_domain(item, entry, position) for item, entry, position in rows),
                total=int(total or 0),
                limit=limit,
                offset=offset,
            )

        return await self._tx.execute(_run)
