"""`StudyService` — add dictionary entries to the study queue and list them."""

from __future__ import annotations

from shougong.usecase.commons.exceptions import ConflictError, ResourceNotFoundError
from shougong.usecase.commons.logging import get_logger
from shougong.usecase.commons.time import IClock
from shougong.usecase.configuration.transaction import ITransactionTemplate
from shougong.usecase.dictionary.gateway import IDictionaryRepository
from shougong.usecase.srs.engine import ISrsEngine
from shougong.usecase.srs.model import SrsRating, SrsReviewLog
from shougong.usecase.study.gateway import IStudyItemRepository
from shougong.usecase.study.model import ReviewResult, StudyItem

_log = get_logger(__name__)


class StudyService:
    def __init__(
        self,
        study_repository: IStudyItemRepository,
        dictionary_repository: IDictionaryRepository,
        engine: ISrsEngine,
        clock: IClock,
        transaction_template: ITransactionTemplate,
    ) -> None:
        self._study = study_repository
        self._dictionary = dictionary_repository
        self._engine = engine
        self._clock = clock
        self._tx = transaction_template

    async def add_item(self, entry_id: int) -> StudyItem:
        async def _run() -> StudyItem:
            entry = await self._dictionary.get(entry_id)
            if entry is None:
                raise ResourceNotFoundError("dictionary_entry", str(entry_id))
            if await self._study.exists_for_entry(entry_id):
                raise ConflictError(f"dictionary entry {entry_id} is already a study item")
            now = self._clock.now()
            item = await self._study.create(entry, self._engine.new_card(now), now)
            _log.info("study.item.added", item_id=item.id, entry_id=entry_id)
            return item

        return await self._tx.execute(_run)

    async def list_items(self, *, due_only: bool, limit: int = 50, offset: int = 0) -> list[StudyItem]:
        due_before = self._clock.now() if due_only else None
        return await self._study.list(due_before=due_before, limit=limit, offset=offset)

    async def get_item(self, item_id: int) -> StudyItem:
        item = await self._study.get(item_id)
        if item is None:
            raise ResourceNotFoundError("study_item", str(item_id))
        return item

    async def review_item(self, item_id: int, rating: SrsRating) -> ReviewResult:
        async def _run() -> ReviewResult:
            item = await self._study.get(item_id)
            if item is None:
                raise ResourceNotFoundError("study_item", str(item_id))
            now = self._clock.now()
            if item.card.due > now:
                raise ConflictError(f"study item {item_id} is not due until {item.card.due.isoformat()}")
            next_card, log = self._engine.review(item.card, rating, now)
            updated = await self._study.update_card(item_id, next_card, now)
            await self._study.add_review_log(item_id, log)
            _log.info("study.item.reviewed", item_id=item_id, rating=rating.name.lower(), due=next_card.due.isoformat())
            return ReviewResult(item=updated, log=log)

        return await self._tx.execute(_run)

    async def item_reviews(self, item_id: int, *, limit: int = 50, offset: int = 0) -> list[SrsReviewLog]:
        async def _run() -> list[SrsReviewLog]:
            if await self._study.get(item_id) is None:
                raise ResourceNotFoundError("study_item", str(item_id))
            return await self._study.list_reviews(item_id, limit=limit, offset=offset)

        return await self._tx.execute(_run)
