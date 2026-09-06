"""`VocabularyProfileService` — keep a grammatical profile of the learner's known
words, resolved from the HSK dataset, so a later step can build a balanced
working set.

`sync` is idempotent and never touches a word the user has overridden by hand.
Nothing here is on the text-generation path.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import replace

from shougong.usecase.commons.logging import get_logger
from shougong.usecase.commons.time import IClock
from shougong.usecase.dictionary.gateway import IDictionaryRepository
from shougong.usecase.reading.gateway import IHskVocabularySource, IVocabularyProfileRepository
from shougong.usecase.reading.vocabulary import (
    QUALIFIER_FLOOR,
    HskEntry,
    ProfileSource,
    VocabularyCategory,
    VocabularyProfile,
    VocabularySummary,
    category_for,
)
from shougong.usecase.study.gateway import IStudyItemRepository

_log = get_logger(__name__)


class VocabularyProfileService:
    def __init__(
        self,
        study_repository: IStudyItemRepository,
        dictionary_repository: IDictionaryRepository,
        hsk_source: IHskVocabularySource,
        profile_repository: IVocabularyProfileRepository,
        clock: IClock,
    ) -> None:
        self._study = study_repository
        self._dictionary = dictionary_repository
        self._hsk = hsk_source
        self._profiles = profile_repository
        self._clock = clock

    async def sync(self) -> VocabularySummary:
        known = await self._study.list_known_entries()
        existing = {p.simplified: p for p in await self._profiles.list_all()}
        try:
            hsk = await self._hsk.fetch()
        except Exception:
            # Upstream unreachable — keep whatever profiles we already have
            # rather than failing the request.
            _log.exception("vocabulary.sync.hsk_unavailable")
            return _summarise(list(existing.values()))

        resolved: list[VocabularyProfile] = []
        for entry in known:
            word = entry.simplified
            if word in existing and existing[word].source is ProfileSource.MANUAL:
                continue
            resolved.append(_profile_for(word, hsk.get(word)))

        if resolved:
            await self._profiles.upsert_many(resolved, self._clock.now())
        _log.info("vocabulary.sync", known=len(known), resolved=len(resolved))
        return await self.summary()

    async def list(self) -> list[VocabularyProfile]:
        profiles = await self._profiles.list_all()
        entries = await self._dictionary.find_by_simplified_many(tuple(p.simplified for p in profiles))
        by_word = {e.simplified: e for e in entries}  # first reading wins
        return [
            replace(
                p,
                pinyin=by_word[p.simplified].pinyin if p.simplified in by_word else None,
                gloss="; ".join(by_word[p.simplified].definitions) if p.simplified in by_word else None,
            )
            for p in profiles
        ]

    async def summary(self) -> VocabularySummary:
        return _summarise(await self._profiles.list_all())

    async def override(
        self, simplified: str, pos_category: VocabularyCategory, hsk_level: int | None
    ) -> VocabularyProfile:
        existing = await self._profiles.get(simplified)
        profile = VocabularyProfile(
            simplified=simplified,
            hsk_level=hsk_level,
            pos_tags=existing.pos_tags if existing else (),
            pos_category=pos_category,
            source=ProfileSource.MANUAL,
        )
        await self._profiles.upsert_many([profile], self._clock.now())
        return profile


def _profile_for(word: str, hsk_entry: HskEntry | None) -> VocabularyProfile:
    if hsk_entry is None:
        return VocabularyProfile(
            simplified=word,
            hsk_level=None,
            pos_tags=(),
            pos_category=category_for(word, ()),
            source=ProfileSource.UNKNOWN,
        )
    return VocabularyProfile(
        simplified=word,
        hsk_level=hsk_entry.hsk_level,
        pos_tags=hsk_entry.pos_tags,
        pos_category=category_for(word, hsk_entry.pos_tags),
        source=ProfileSource.HSK,
    )


def _summarise(profiles: list[VocabularyProfile]) -> VocabularySummary:
    by_category = Counter(p.pos_category.value for p in profiles)
    by_level = Counter(str(p.hsk_level) if p.hsk_level is not None else "none" for p in profiles)
    return VocabularySummary(
        total=len(profiles),
        categorised=sum(1 for p in profiles if p.source is not ProfileSource.UNKNOWN),
        by_category=dict(by_category),
        by_hsk_level=dict(by_level),
        qualifier_shortage=by_category.get(VocabularyCategory.QUALIFIER.value, 0) < QUALIFIER_FLOOR,
    )
