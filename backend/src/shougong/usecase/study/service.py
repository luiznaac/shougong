"""`StudyService` — add dictionary entries to the study queue, list them,
prioritise them and build lesson/review sessions."""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from dataclasses import dataclass, replace

from shougong.usecase.commons.asyncx import fire_and_forget
from shougong.usecase.commons.exceptions import ConflictError, InvalidRangeError, ResourceNotFoundError
from shougong.usecase.commons.page import Page
from shougong.usecase.commons.time import IClock
from shougong.usecase.configuration.transaction import ITransactionTemplate
from shougong.usecase.dictionary.gateway import IDictionaryRepository
from shougong.usecase.dictionary.model import DictionaryEntry
from shougong.usecase.dictionary.pinyin import is_numbered_pinyin, sanitize_pinyin
from shougong.usecase.srs.engine import ISrsEngine
from shougong.usecase.srs.model import SrsRating, SrsReviewLog, SrsState
from shougong.usecase.strokes.service import StrokeService
from shougong.usecase.study.gateway import IStudyItemRepository
from shougong.usecase.study.model import (
    BatchImportOutcome,
    BatchImportReport,
    BatchImportRow,
    BatchRowStatus,
    ImportSkipReason,
    ItemSource,
    PriorityEdge,
    ReviewResult,
    SessionKind,
    StudyItem,
    StudyItemFilters,
    StudySession,
)
from shougong.usecase.study.shuffler import IShuffler
from shougong.usecase.study.telemetry import StudyTelemetry


def _batch_outcome(
    row: int,
    hanzi: str,
    pinyin: str,
    status: BatchRowStatus,
    *,
    study_item_id: int | None = None,
    detail: str | None = None,
    candidates: tuple[DictionaryEntry, ...] = (),
) -> BatchImportOutcome:
    return BatchImportOutcome(
        row=row,
        hanzi=hanzi,
        pinyin=pinyin,
        status=status,
        study_item_id=study_item_id,
        detail=detail,
        candidates=candidates,
    )


def _describe(entry: DictionaryEntry) -> str:
    return f"#{entry.id} ({'; '.join(entry.definitions) or '—'})"


@dataclass(frozen=True, slots=True)
class _Unresolved:
    """A row that produced no item: the bounded reason telemetry counts and the
    human-readable detail the HTTP response carries.

    `candidates` is populated only for an ambiguous match the caller can resolve
    by hand — several entries matched exactly, or none did but the hanzi exists
    under other readings.
    """

    reason: ImportSkipReason
    detail: str
    candidates: tuple[DictionaryEntry, ...] = ()


class StudyService:
    def __init__(
        self,
        study_repository: IStudyItemRepository,
        dictionary_repository: IDictionaryRepository,
        engine: ISrsEngine,
        clock: IClock,
        transaction_template: ITransactionTemplate,
        stroke_service: StrokeService,
        shuffler: IShuffler,
        telemetry: StudyTelemetry,
    ) -> None:
        self._study = study_repository
        self._dictionary = dictionary_repository
        self._engine = engine
        self._clock = clock
        self._tx = transaction_template
        self._strokes = stroke_service
        self._shuffler = shuffler
        self._telemetry = telemetry

    async def add_item(self, entry_id: int) -> StudyItem:
        async def _run() -> StudyItem:
            entry = await self._dictionary.get(entry_id)
            if entry is None:
                raise ResourceNotFoundError("dictionary_entry", str(entry_id))
            if await self._study.exists_for_entry(entry_id):
                raise ConflictError(f"dictionary entry {entry_id} is already a study item")
            now = self._clock.now()
            item = await self._study.create(entry, self._engine.new_card(now), now)
            self._telemetry.item_added(item_id=item.id, entry_id=entry_id, source=ItemSource.API)
            return item

        item = await self._tx.execute(_run)
        self._warm_strokes(item.entry.simplified)
        return item

    def _warm_strokes(self, word: str) -> None:
        """Fire off a background cache warm-up for each distinct character in
        `word`, so its stroke data is ready by the time the learner looks at
        it. Scheduled *after* the enclosing transaction has committed and
        closed — the warm-up runs its own separate transaction, and firing it
        from inside `_run()` would hand the background task a session that's
        about to be closed out from under it.
        """
        for char in set(word):
            fire_and_forget(self._strokes.warm(char))

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

                if isinstance(resolved, _Unresolved):
                    outcomes.append(
                        _batch_outcome(
                            index,
                            hanzi,
                            pinyin,
                            BatchRowStatus.ERROR,
                            detail=resolved.detail,
                            candidates=resolved.candidates,
                        )
                    )
                    self._telemetry.import_row_skipped(reason=resolved.reason)
                    continue
                if resolved.id in used_entry_ids or await self._study.exists_for_entry(resolved.id):
                    outcomes.append(
                        _batch_outcome(index, hanzi, pinyin, BatchRowStatus.SKIPPED, detail="já está na fila")
                    )
                    self._telemetry.import_row_skipped(reason=ImportSkipReason.DUPLICATE)
                    continue

                item = await self._study.create(resolved, self._engine.new_card(now), now)
                used_entry_ids.add(resolved.id)
                outcomes.append(_batch_outcome(index, hanzi, pinyin, BatchRowStatus.CREATED, study_item_id=item.id))
                self._telemetry.item_added(item_id=item.id, entry_id=resolved.id, source=ItemSource.IMPORT)

            self._telemetry.batch_imported()
            return BatchImportReport(outcomes=tuple(outcomes))

        report = await self._tx.execute(_run)
        for outcome in report.outcomes:
            if outcome.status is BatchRowStatus.CREATED:
                self._warm_strokes(outcome.hanzi)
        return report

    async def _resolve_batch_row(self, hanzi: str, pinyin: str) -> DictionaryEntry | _Unresolved:
        """The dictionary entry for one CSV row, or the bounded reason it produced
        no item plus the detail the caller can act on.

        A row that can't be auto-resolved but has candidates in the dictionary
        (several exact matches, or none but other readings exist) is ambiguous and
        carries those candidates so the caller can resolve it by hand.

        Stored `dictionary_entry.pinyin` is sanitised on import (lower-cased, ü as
        `v` — see `sanitize_pinyin`), so the row's pinyin is sanitised the same way
        before the exact match. This canonicalises case/ü-spelling only; it never
        touches tones or syllables.
        """
        if not hanzi:
            return _Unresolved(ImportSkipReason.FORMAT, "hanzi vazio")
        if not is_numbered_pinyin(pinyin):
            return _Unresolved(
                ImportSkipReason.FORMAT,
                "pinyin fora do formato esperado (use tons numéricos, ex.: xue2 xi2)",
            )

        candidates = await self._dictionary.find_by_simplified(hanzi)
        if not candidates:
            return _Unresolved(ImportSkipReason.NOT_FOUND, "hanzi não encontrado no dicionário")

        matches = [entry for entry in candidates if entry.pinyin == sanitize_pinyin(pinyin)]
        if not matches:
            listed = ", ".join(_describe(entry) for entry in candidates)
            return _Unresolved(
                ImportSkipReason.AMBIGUOUS,
                f"sem correspondência exata; outras leituras no dicionário: {listed}",
                tuple(candidates),
            )
        if len(matches) > 1:
            listed = ", ".join(_describe(entry) for entry in matches)
            return _Unresolved(
                ImportSkipReason.AMBIGUOUS,
                f"múltiplas entradas do dicionário casam: {listed}",
                tuple(matches),
            )
        return matches[0]

    async def list_items(
        self,
        filters: StudyItemFilters,
        *,
        limit: int = 20,
        offset: int = 0,
    ) -> Page[StudyItem]:
        """One page of the filtered, ordered queue and the filtered set's exact total.

        `due` is resolved here so adapters see only instant bounds: with an
        explicit `due_to`, the earlier of it and the clock wins again.
        """
        if filters.due:
            now = self._clock.now()
            upper = now if filters.due_to is None else min(filters.due_to, now)
            filters = replace(filters, due=False, due_to=upper)
        if filters.search is not None:
            filters = replace(filters, search=filters.search.strip())
        if filters.due_from is not None and filters.due_to is not None and filters.due_from >= filters.due_to:
            raise InvalidRangeError("study-item range is inverted: 'due_from' must be before 'due_to'")
        return await self._study.list(filters, limit=limit, offset=offset)

    async def get_item(self, item_id: int) -> StudyItem:
        item = await self._study.get(item_id)
        if item is None:
            raise ResourceNotFoundError("study_item", str(item_id))
        return item

    async def prioritise(self, item_id: int, edge: PriorityEdge) -> StudyItem:
        """Pin a learning item to the front or back of the lesson queue, or move
        an already-pinned item to the other edge."""

        async def _run() -> StudyItem:
            item = await self._study.get(item_id)
            if item is None:
                raise ResourceNotFoundError("study_item", str(item_id))
            if item.card.state is not SrsState.LEARNING:
                raise ConflictError(f"study item {item_id} is not learning")
            return await self._study.prioritise(item_id, edge)

        return await self._tx.execute(_run)

    async def deprioritise(self, item_id: int) -> None:
        """Unpin an item; a no-op when it was not prioritised."""

        async def _run() -> None:
            if await self._study.get(item_id) is None:
                raise ResourceNotFoundError("study_item", str(item_id))
            await self._study.deprioritise(item_id)

        await self._tx.execute(_run)

    async def session(self, kind: SessionKind) -> StudySession:
        """One fresh lesson or review selection, in the order the client presents it.

        A lesson keeps its pinned block first, ascending by position then id, and
        never shuffles it; only the unpinned remainder is shuffled. A review shuffles
        the whole due block with no priority weighting.
        """
        now = self._clock.now()
        items = await self._study.list_for_session(kind, now=now)
        if kind is SessionKind.REVIEW:
            ordered = self._shuffler.shuffle(items)
        else:
            pinned = [item for item in items if item.priority_position is not None]
            remainder = [item for item in items if item.priority_position is None]
            ordered = [*pinned, *self._shuffler.shuffle(remainder)]
        self._telemetry.session_created(kind=kind, size=len(ordered))
        return StudySession(session_id=uuid.uuid4().hex, kind=kind, items=tuple(ordered))

    async def review_item(self, item_id: int, rating: SrsRating) -> ReviewResult:
        async def _run() -> ReviewResult:
            item = await self._study.get(item_id)
            if item is None:
                raise ResourceNotFoundError("study_item", str(item_id))
            now = self._clock.now()
            if item.card.due > now:
                raise ConflictError(f"study item {item_id} is not due until {item.card.due.isoformat()}")
            previous_state = item.card.state
            next_card, log = self._engine.review(item.card, rating, now)
            updated = await self._study.update_card(item_id, next_card, now)
            await self._study.add_review_log(item_id, log)
            self._telemetry.item_reviewed(rating=rating, state=previous_state)
            if previous_state is SrsState.LEARNING and next_card.state is SrsState.REVIEW:
                self._telemetry.item_graduated()
            self._telemetry.review_lag((now - item.card.due).total_seconds())
            return ReviewResult(item=updated, log=log)

        return await self._tx.execute(_run)

    async def item_reviews(self, item_id: int, *, limit: int = 50, offset: int = 0) -> list[SrsReviewLog]:
        async def _run() -> list[SrsReviewLog]:
            if await self._study.get(item_id) is None:
                raise ResourceNotFoundError("study_item", str(item_id))
            return await self._study.list_reviews(item_id, limit=limit, offset=offset)

        return await self._tx.execute(_run)
