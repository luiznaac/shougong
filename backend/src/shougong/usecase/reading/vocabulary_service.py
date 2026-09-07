"""`VocabularyOverviewService` — a read-only grammatical overview of the learner's
known words, derived on the fly from the dictionary (which carries HSK level and
POS tags) so the "Meu vocabulário" panel can show the breakdown.

Nothing here is on the text-generation path and nothing is persisted.
"""

from __future__ import annotations

from collections import Counter
from collections.abc import Iterable, Sequence

from shougong.usecase.commons.logging import get_logger
from shougong.usecase.dictionary.gateway import IDictionaryRepository
from shougong.usecase.dictionary.model import DictionaryEntry
from shougong.usecase.reading.proficiency import estimate_proficiency
from shougong.usecase.reading.vocabulary import (
    QUALIFIER_FLOOR,
    VocabularyCategory,
    VocabularySummary,
    VocabularyWord,
    categories_for,
    hsk_level_stats,
)
from shougong.usecase.study.gateway import IStudyItemRepository

_log = get_logger(__name__)


class VocabularyOverviewService:
    def __init__(
        self,
        study_repository: IStudyItemRepository,
        dictionary_repository: IDictionaryRepository,
    ) -> None:
        self._study = study_repository
        self._dictionary = dictionary_repository

    async def list(self) -> list[VocabularyWord]:
        return [_word_for(entry) for entry in _distinct(await self._study.list_known_entries())]

    async def summary(self) -> VocabularySummary:
        total_by_level = hsk_level_stats(await self._dictionary.hsk_words()).total_by_level
        words = [_word_for(entry) for entry in _distinct(await self._study.list_known_entries())]

        by_category: Counter[str] = Counter()
        for word in words:
            by_category.update(category.value for category in word.pos_categories)
        by_level = Counter(str(w.hsk_level) if w.hsk_level is not None else "none" for w in words)
        known_by_level = Counter(w.hsk_level for w in words if w.hsk_level is not None)

        _log.info("vocabulary.overview", known=len(words))
        return VocabularySummary(
            total=len(words),
            categorised=sum(1 for w in words if w.hsk_level is not None),
            by_category=dict(by_category),
            by_hsk_level=dict(by_level),
            qualifier_shortage=by_category.get(VocabularyCategory.QUALIFIER.value, 0) < QUALIFIER_FLOOR,
            proficiency=estimate_proficiency(known_by_level, total_by_level),
        )


def _distinct(entries: Sequence[DictionaryEntry]) -> Iterable[DictionaryEntry]:
    """One entry per simplified form — a hanzi with several readings is one word
    here (they share HSK level and POS tags). First reading wins."""
    seen: set[str] = set()
    for entry in entries:
        if entry.simplified not in seen:
            seen.add(entry.simplified)
            yield entry


def _word_for(entry: DictionaryEntry) -> VocabularyWord:
    return VocabularyWord(
        simplified=entry.simplified,
        hsk_level=entry.hsk_level,
        pos_tags=entry.pos_tags,
        pos_categories=categories_for(entry.simplified, entry.pos_tags),
        pinyin=entry.pinyin,
        gloss="; ".join(entry.definitions) if entry.definitions else None,
    )
