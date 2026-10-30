"""`InsightRepository` — implements `IInsightRepository` against MySQL.

Every read is batched: the grade window is one windowed query for the whole page,
and each Extra Study bucket is one grouped/lag query plus its count.
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Sequence
from datetime import datetime

from sqlalchemy import func, select

from shougong.persistence.configuration.time import as_utc as _as_utc
from shougong.persistence.configuration.time import naive_utc as _naive_utc
from shougong.persistence.configuration.transaction import SqlAlchemyTransactionTemplate, current_session
from shougong.persistence.dictionary.entity import DictionaryEntryEntity
from shougong.persistence.study.entity import ReviewLogEntity, StudyItemEntity
from shougong.persistence.study.repository import to_domain
from shougong.persistence.study_item_history.entity import StudyItemHistoryEntity
from shougong.usecase.insights.gateway import IInsightRepository
from shougong.usecase.insights.model import GradeWindow, InsightBucket, ReviewGrade
from shougong.usecase.srs.model import SrsRating, SrsState


class InsightRepository(IInsightRepository):
    def __init__(self, transaction_template: SqlAlchemyTransactionTemplate) -> None:
        self._tx = transaction_template

    async def list_grade_windows(self, item_ids: Sequence[int] | None, *, window_size: int) -> list[GradeWindow]:
        if item_ids is not None and not item_ids:
            return []

        async def _run() -> list[GradeWindow]:
            session = current_session()
            ranked = select(
                ReviewLogEntity.id.label("log_id"),
                ReviewLogEntity.study_item_id.label("item_id"),
                ReviewLogEntity.rating.label("rating"),
                ReviewLogEntity.review_datetime.label("review_datetime"),
                func.row_number()
                .over(
                    partition_by=ReviewLogEntity.study_item_id,
                    order_by=(ReviewLogEntity.review_datetime.desc(), ReviewLogEntity.id.desc()),
                )
                .label("position"),
            )
            if item_ids is not None:
                ranked = ranked.where(ReviewLogEntity.study_item_id.in_(item_ids))
            window = ranked.subquery()
            stmt = (
                select(window.c.item_id, window.c.rating, window.c.review_datetime)
                .where(window.c.position <= window_size)
                .order_by(window.c.item_id, window.c.review_datetime.desc(), window.c.log_id.desc())
            )
            rows = (await session.execute(stmt)).all()
            grouped: dict[int, list[ReviewGrade]] = defaultdict(list)
            for item_id, rating, review_datetime in rows:
                grouped[item_id].append(ReviewGrade(rating=SrsRating(rating), review_datetime=_as_utc(review_datetime)))
            return [GradeWindow(study_item_id=item_id, grades=tuple(grades)) for item_id, grades in grouped.items()]

        return await self._tx.execute(_run)

    async def recent_mistakes(self, *, start: datetime, end: datetime, limit: int) -> InsightBucket:
        async def _run() -> InsightBucket:
            session = current_session()
            latest_failure = func.max(ReviewLogEntity.review_datetime).label("latest_failure")
            predicates = (
                ReviewLogEntity.rating == int(SrsRating.AGAIN),
                ReviewLogEntity.review_datetime >= _naive_utc(start),
                ReviewLogEntity.review_datetime < _naive_utc(end),
                StudyItemEntity.card_state.in_((int(SrsState.REVIEW), int(SrsState.RELEARNING))),
            )
            stmt = (
                select(StudyItemEntity, DictionaryEntryEntity)
                .join(ReviewLogEntity, ReviewLogEntity.study_item_id == StudyItemEntity.id)
                .join(DictionaryEntryEntity, StudyItemEntity.entry_id == DictionaryEntryEntity.id)
                .where(*predicates)
                .group_by(StudyItemEntity.id, DictionaryEntryEntity.id)
                .order_by(latest_failure.desc(), StudyItemEntity.id)
                .limit(limit)
            )
            rows = (await session.execute(stmt)).all()
            total = await session.scalar(
                select(func.count(func.distinct(ReviewLogEntity.study_item_id)))
                .join(StudyItemEntity, ReviewLogEntity.study_item_id == StudyItemEntity.id)
                .where(*predicates)
            )
            return InsightBucket(
                total=int(total or 0),
                items=tuple(to_domain(item, entry) for item, entry in rows),
            )

        return await self._tx.execute(_run)

    async def recently_learned(self, *, start: datetime, end: datetime, limit: int) -> InsightBucket:
        async def _run() -> InsightBucket:
            session = current_session()
            history = StudyItemHistoryEntity
            # LAG ranks the whole trail first; the date predicate must run on the
            # transition row afterwards, or a graduation whose previous row is
            # outside the range would be dropped.
            previous_state = func.lag(history.card_state).over(
                partition_by=history.study_item_id,
                order_by=(history.created_at.asc(), history.id.asc()),
            )
            ranked = select(
                history.id.label("history_id"),
                history.card_state.label("state"),
                history.created_at.label("created_at"),
                previous_state.label("previous_state"),
            ).subquery()
            transition = (
                select(ranked.c.history_id)
                .where(
                    ranked.c.state == int(SrsState.REVIEW),
                    ranked.c.previous_state == int(SrsState.LEARNING),
                    ranked.c.created_at >= _naive_utc(start),
                    ranked.c.created_at < _naive_utc(end),
                )
                .subquery()
            )
            stmt = (
                select(StudyItemEntity, DictionaryEntryEntity)
                .join(StudyItemHistoryEntity, StudyItemHistoryEntity.study_item_id == StudyItemEntity.id)
                .join(DictionaryEntryEntity, StudyItemEntity.entry_id == DictionaryEntryEntity.id)
                .where(StudyItemHistoryEntity.id.in_(select(transition.c.history_id)))
                .order_by(StudyItemHistoryEntity.created_at.desc(), StudyItemHistoryEntity.id.desc())
                .limit(limit)
            )
            rows = (await session.execute(stmt)).all()
            total = await session.scalar(select(func.count()).select_from(transition))
            return InsightBucket(
                total=int(total or 0),
                items=tuple(to_domain(item, entry) for item, entry in rows),
            )

        return await self._tx.execute(_run)
