"""`InsightService` — derive leech flags and the Extra Study buckets on every read.

Nothing here writes: the insight port is read-only, so "practice never records"
is a structural property of the slice, not a convention.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime, timedelta
from types import MappingProxyType

from shougong.usecase.commons.exceptions import InvalidRangeError
from shougong.usecase.configuration.transaction import ITransactionTemplate
from shougong.usecase.insights.gateway import IInsightRepository
from shougong.usecase.insights.model import ExtraStudyReport
from shougong.usecase.insights.policy import ITEM_CAP, MAX_RANGE_DAYS, WINDOW_SIZE, is_leech, order_leeches
from shougong.usecase.study.gateway import IStudyItemRepository
from shougong.usecase.study.model import StudyItem

type ItemFlags = dict[int, bool]


def _validate_range(start: datetime, end: datetime) -> None:
    if start >= end:
        raise InvalidRangeError("extra-study range is inverted: 'from' must be before 'to'")
    if end - start > timedelta(days=MAX_RANGE_DAYS):
        raise InvalidRangeError(f"extra-study range is longer than {MAX_RANGE_DAYS} days")


class InsightService:
    def __init__(
        self,
        insight_repository: IInsightRepository,
        study_repository: IStudyItemRepository,
        transaction_template: ITransactionTemplate,
    ) -> None:
        self._insights = insight_repository
        self._study = study_repository
        self._tx = transaction_template

    async def leech_flags(self, item_ids: Sequence[int]) -> ItemFlags:
        """One batched window read for the whole page; ids with no history are false."""

        async def _run() -> ItemFlags:
            windows = await self._insights.list_grade_windows(item_ids, window_size=WINDOW_SIZE)
            flagged = {window.study_item_id for window in windows if is_leech(window)}
            return {item_id: item_id in flagged for item_id in item_ids}

        if not item_ids:
            return {}
        return await self._tx.execute(_run)

    async def leech_items(self, *, limit: int = 50, offset: int = 0) -> tuple[list[StudyItem], ItemFlags]:
        """The queue-wide leech list, worst first, paginated in the policy's order.

        Every leech on the page carries `True` in the returned flag map, so the
        HTTP layer can use one response mapper for both list flavours.
        """

        async def _run() -> tuple[list[StudyItem], ItemFlags]:
            windows = await self._insights.list_grade_windows(None, window_size=WINDOW_SIZE)
            page = order_leeches(windows)[offset : offset + limit]
            items = await self._study.get_many([rank.study_item_id for rank in page])
            by_id = {item.id: item for item in items}
            ordered = [by_id[rank.study_item_id] for rank in page if rank.study_item_id in by_id]
            return ordered, {item.id: True for item in ordered}

        return await self._tx.execute(_run)

    async def extra_study(self, *, start: datetime, end: datetime) -> ExtraStudyReport:
        """Both buckets for `[start, end)`, each with its true total and 200-item cap,
        plus the leech flag for every item they carry.
        """
        _validate_range(start, end)

        async def _run() -> ExtraStudyReport:
            mistakes = await self._insights.recent_mistakes(start=start, end=end, limit=ITEM_CAP)
            learned = await self._insights.recently_learned(start=start, end=end, limit=ITEM_CAP)
            item_ids = [item.id for item in (*mistakes.items, *learned.items)]
            flags = await self.leech_flags(item_ids)
            return ExtraStudyReport(
                start=start,
                end=end,
                recent_mistakes=mistakes,
                recently_learned=learned,
                leech_flags=MappingProxyType(flags),
            )

        return await self._tx.execute(_run)
