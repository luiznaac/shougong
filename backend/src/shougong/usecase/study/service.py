"""`StudyService` — add dictionary entries to the study queue and list them."""

from __future__ import annotations

from collections.abc import Sequence

from shougong.usecase.commons.exceptions import ConflictError, ResourceNotFoundError
from shougong.usecase.commons.logging import get_logger
from shougong.usecase.commons.time import IClock
from shougong.usecase.configuration.transaction import ITransactionTemplate
from shougong.usecase.dictionary.gateway import IDictionaryRepository
from shougong.usecase.dictionary.model import DictionaryEntry
from shougong.usecase.dictionary.pinyin import is_numbered_pinyin, sanitize_pinyin
from shougong.usecase.srs.engine import ISrsEngine
from shougong.usecase.srs.model import SrsRating, SrsReviewLog
from shougong.usecase.study.gateway import IStudyItemRepository
from shougong.usecase.study.model import (
    BatchImportOutcome,
    BatchImportReport,
    BatchImportRow,
    BatchRowStatus,
    ReviewResult,
    StudyItem,
)

_log = get_logger(__name__)


def _batch_outcome(
    row: int,
    hanzi: str,
    pinyin: str,
    status: BatchRowStatus,
    *,
    study_item_id: int | None = None,
    detail: str | None = None,
) -> BatchImportOutcome:
    return BatchImportOutcome(
        row=row, hanzi=hanzi, pinyin=pinyin, status=status, study_item_id=study_item_id, detail=detail
    )


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

    async def import_batch(self, rows: Sequence[BatchImportRow]) -> BatchImportReport:
        """Enqueue many items at once, one CSV row per item.

        Every row is resolved to an existing dictionary entry by an *exact*
        hanzi + numbered-pinyin match. Valid rows are all created in one
        transaction; a row that can't be resolved (bad format, no match,
        ambiguous, already queued) is reported, never raised.
        """

        async def _run() -> BatchImportReport:
            now = self._clock.now()
            outcomes: list[BatchImportOutcome] = []
            used_entry_ids: set[int] = set()

            for index, raw in enumerate(rows, start=1):
                hanzi = raw.hanzi.strip()
                pinyin = raw.pinyin.strip()
                resolved = await self._resolve_batch_row(hanzi, pinyin)

                if isinstance(resolved, str):
                    outcomes.append(_batch_outcome(index, hanzi, pinyin, BatchRowStatus.ERROR, detail=resolved))
                    continue
                if resolved.id in used_entry_ids or await self._study.exists_for_entry(resolved.id):
                    outcomes.append(
                        _batch_outcome(index, hanzi, pinyin, BatchRowStatus.SKIPPED, detail="já está na fila")
                    )
                    continue

                item = await self._study.create(resolved, self._engine.new_card(now), now)
                used_entry_ids.add(resolved.id)
                outcomes.append(_batch_outcome(index, hanzi, pinyin, BatchRowStatus.CREATED, study_item_id=item.id))

            created = sum(1 for o in outcomes if o.status is BatchRowStatus.CREATED)
            skipped = sum(1 for o in outcomes if o.status is BatchRowStatus.SKIPPED)
            errored = sum(1 for o in outcomes if o.status is BatchRowStatus.ERROR)
            _log.info("study.batch.imported", rows=len(rows), created=created, skipped=skipped, errors=errored)
            return BatchImportReport(outcomes=tuple(outcomes))

        return await self._tx.execute(_run)

    async def _resolve_batch_row(self, hanzi: str, pinyin: str) -> DictionaryEntry | str:
        """The dictionary entry for one CSV row, or an error message explaining why not.

        Stored `dictionary_entry.pinyin` is sanitised on import (lower-cased, ü as
        `v` — see `sanitize_pinyin`), so the row's pinyin is sanitised the same way
        before the exact match. This canonicalises case/ü-spelling only; it never
        touches tones or syllables.
        """
        if not hanzi:
            return "hanzi vazio"
        if not is_numbered_pinyin(pinyin):
            return "pinyin fora do formato esperado (use tons numéricos, ex.: xue2 xi2)"

        candidates = await self._dictionary.find_by_simplified(hanzi)
        matches = [entry for entry in candidates if entry.pinyin == sanitize_pinyin(pinyin)]
        if not matches:
            if not candidates:
                return "hanzi não encontrado no dicionário"
            readings = ", ".join(sorted(entry.pinyin for entry in candidates))
            return f"sem correspondência exata; leituras no dicionário: {readings}"
        if len(matches) > 1:
            listed = ", ".join(f"#{entry.id} ({'; '.join(entry.definitions) or '—'})" for entry in matches)
            return f"múltiplas entradas do dicionário casam: {listed}"
        return matches[0]

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
