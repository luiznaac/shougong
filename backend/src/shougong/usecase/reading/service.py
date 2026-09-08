"""`ReadingService` — generate a vocabulary-restricted reading text, validate it
locally against the learner's known words, and persist the result.

The LLM is only ever responsible for the running text. It is asked once; if the
draft uses more distinct words outside the learner's vocabulary than requested
(or, for dialogue, breaks the turn structure), the exact problems are handed
back and a rewrite is requested, up to `request.max_attempts` times. Every draft
— including the rejected ones — is kept on the saved reading as an audit trail.
Segmentation, word-level vocabulary validation, and pinyin/definitions all
happen locally — the model never sees or returns a translation, and never
decides what counts as "known".
"""

from __future__ import annotations

import random
from collections import Counter
from dataclasses import replace

from shougong.usecase.commons.logging import get_logger
from shougong.usecase.commons.time import IClock
from shougong.usecase.dictionary.gateway import IDictionaryRepository
from shougong.usecase.dictionary.model import DictionaryEntry
from shougong.usecase.reading.dialogue import check_dialogue
from shougong.usecase.reading.gateway import (
    DialogueLine,
    IReadingHistoryRepository,
    IReadingTextGateway,
    IReadingTopicRepository,
    IReadingWordUsageRepository,
    ISegmenter,
    ReadingDraft,
    RejectedDraft,
    SegmentedToken,
)
from shougong.usecase.reading.model import (
    GeneratedReading,
    GenerationAttempt,
    ReadingFormat,
    ReadingPunctuation,
    ReadingRequest,
    ReadingSpeaker,
    ReadingToken,
    ReadingWord,
    SavedReadingText,
)
from shougong.usecase.reading.proficiency import BudgetAudience, budget_audience, estimate_proficiency
from shougong.usecase.reading.speakers import resolve_speakers, usage_keys, usage_keys_for
from shougong.usecase.reading.topics import resolve_topic
from shougong.usecase.reading.validation import is_chinese_word, out_of_vocabulary
from shougong.usecase.reading.vocabulary import VocabularyWord, categories_for, hsk_level_stats
from shougong.usecase.reading.working_set import WorkingSet, build_working_set
from shougong.usecase.study.gateway import IStudyItemRepository

_RECENT_TOPICS = 12
_RECENT_OPENINGS = 8

_log = get_logger(__name__)


class ReadingService:
    def __init__(
        self,
        gateway: IReadingTextGateway,
        segmenter: ISegmenter,
        study_repository: IStudyItemRepository,
        dictionary_repository: IDictionaryRepository,
        history_repository: IReadingHistoryRepository,
        word_usage_repository: IReadingWordUsageRepository,
        topic_repository: IReadingTopicRepository,
        clock: IClock,
        rng: random.Random | None = None,
    ) -> None:
        self._gateway = gateway
        self._segmenter = segmenter
        self._study = study_repository
        self._dictionary = dictionary_repository
        self._history = history_repository
        self._word_usage = word_usage_repository
        self._topics = topic_repository
        self._clock = clock
        self._rng = rng or random.Random()

    async def generate(self, request: ReadingRequest) -> SavedReadingText:
        known_index = await self._known_word_index()
        known_words = frozenset(known_index)
        stats = hsk_level_stats(await self._dictionary.hsk_words())
        known_by_level = Counter(entry.hsk_level for entry in known_index.values() if entry.hsk_level is not None)
        proficiency = estimate_proficiency(known_by_level, stats.total_by_level)
        working_set = await self._build_working_set(known_index, proficiency.coverage_by_level)
        audience = (
            BudgetAudience.INTERMEDIATE
            if not stats.total_by_level
            else budget_audience(known_words, stats, proficiency.estimated_level)
        )
        request = await self._resolve_topic(request)
        avoid_openings = await self._recent_openings()

        is_dialogue = request.format is ReadingFormat.DIALOGUE
        speakers = await self._resolve_speakers(known_words) if is_dialogue else ()
        speaker_names = tuple(s.name for s in speakers)
        if is_dialogue:
            _log.info("reading.dialogue.speakers", names=list(speaker_names))
        speaker_chars = frozenset("".join(speaker_names))
        validation_words = known_words | speaker_chars

        attempts: list[GenerationAttempt] = []
        drafts: list[ReadingDraft] = []
        segmentations: list[tuple[SegmentedToken, ...]] = []
        prior: list[RejectedDraft] = []

        for _ in range(request.max_attempts):
            draft = await self._gateway.generate(
                working_set=working_set,
                text_format=request.format,
                max_extra_words=request.max_extra_words,
                model=request.model,
                topic=request.topic,
                budget_audience=audience,
                avoid_openings=avoid_openings,
                speakers=speaker_names,
                prior_attempts=prior,
            )
            segmented = self._segmenter.segment(draft.text)
            extras = out_of_vocabulary([t.text for t in segmented], validation_words)
            problems = check_dialogue(draft.lines, draft.text, frozenset(speaker_names)) if is_dialogue else []

            attempts.append(
                GenerationAttempt(
                    text=draft.text,
                    segmentation=tuple(t.text for t in segmented),
                    extra_words=tuple(extras),
                    prompt_tokens=draft.prompt_tokens,
                    completion_tokens=draft.completion_tokens,
                    chosen=False,
                    dialogue_problems=tuple(problems),
                )
            )
            drafts.append(draft)
            segmentations.append(segmented)

            if len(extras) <= request.max_extra_words and not problems:
                break
            prior.append(RejectedDraft(draft=draft.text, rejected_words=tuple(extras), problems=tuple(problems)))

        chosen = _choose_attempt(attempts, request.max_extra_words)
        attempts[chosen] = replace(attempts[chosen], chosen=True)

        if is_dialogue and drafts[chosen].lines:
            tokens = await self._resolve_dialogue(drafts[chosen].lines, known_index, speaker_chars)
        else:
            tokens = await self._resolve(segmentations[chosen], known_index, allowed_extra=speaker_chars)

        reading = GeneratedReading(
            format=request.format,
            tokens=tokens,
            known_word_count=len(known_words),
            attempts=tuple(attempts),
            working_set=dict(working_set.groups),
            must_use=working_set.must_use,
            speakers=speakers,
        )
        await self._record_word_usage(segmentations[chosen], known_words)
        if speakers:
            await self._word_usage.record(usage_keys_for(speakers), self._clock.now())
        return await self._history.save(request, reading, self._clock.now())

    async def _resolve_topic(self, request: ReadingRequest) -> ReadingRequest:
        if request.topic and request.topic.strip():
            return replace(request, topic=request.topic.strip())
        scenarios = await self._topics.list_active()
        recent = await self._history.list(limit=_RECENT_TOPICS, offset=0)
        resolved = resolve_topic(
            request.topic,
            scenarios,
            [r.request.topic for r in recent if r.request.topic],
            self._rng,
        )
        return replace(request, topic=resolved.text, topic_generated=resolved.generated)

    async def _recent_openings(self) -> list[str]:
        items = await self._history.list(limit=_RECENT_OPENINGS, offset=0)
        openings: list[str] = []
        for item in items:
            words = [t.text for t in item.reading.tokens if isinstance(t, ReadingWord)][:4]
            opening = "".join(words)
            if opening and opening not in openings:
                openings.append(opening)
        return openings

    async def _resolve_speakers(self, known_words: frozenset[str]) -> tuple[ReadingSpeaker, ...]:
        usage = await self._word_usage.load(usage_keys())
        return resolve_speakers(known_words=known_words, usage=usage, now=self._clock.now(), rng=self._rng)

    async def _build_working_set(
        self, known_index: dict[str, DictionaryEntry], coverage_by_level: dict[int, float]
    ) -> WorkingSet:
        profiles = [
            VocabularyWord(
                simplified=entry.simplified,
                hsk_level=entry.hsk_level,
                pos_tags=entry.pos_tags,
                pos_categories=categories_for(entry.simplified, entry.pos_tags),
                pinyin=entry.pinyin,
            )
            for entry in known_index.values()
        ]
        usage = await self._word_usage.load([p.simplified for p in profiles])
        return build_working_set(
            profiles=profiles,
            known_words=frozenset(known_index),
            usage=usage,
            now=self._clock.now(),
            rng=self._rng,
            coverage_by_level=coverage_by_level,
        )

    async def _record_word_usage(self, segmented: tuple[SegmentedToken, ...], known_words: frozenset[str]) -> None:
        used = sorted({t.text for t in segmented if is_chinese_word(t.text) and t.text in known_words})
        if used:
            await self._word_usage.record(used, self._clock.now())

    async def list_models(self) -> tuple[str, ...]:
        return await self._gateway.list_models()

    async def list_history(self, *, limit: int, offset: int) -> list[SavedReadingText]:
        items = await self._history.list(limit=limit, offset=offset)
        return await self._hydrate(items)

    async def _known_word_index(self) -> dict[str, DictionaryEntry]:
        entries = await self._study.list_known_entries()
        return {entry.simplified: entry for entry in entries}

    async def _hydrate(self, items: list[SavedReadingText]) -> list[SavedReadingText]:
        """Fill in pinyin/definitions/`dictionary_entry_id` from the
        dictionary — history never stores them, only the segmented word text
        and whether it was extra, so a listed reading always reflects the
        dictionary's (and the study queue's) current content. Resolved the
        same way as generation — prefer the studied reading, else the
        dictionary's first match — from one batched lookup regardless of how
        many readings/words there are.
        """
        known_index = await self._known_word_index()
        words = {token.text for item in items for token in item.reading.tokens if isinstance(token, ReadingWord)}

        candidates_by_word: dict[str, list[DictionaryEntry]] = {}
        for entry in await self._dictionary.find_by_simplified_many(tuple(words)):
            candidates_by_word.setdefault(entry.simplified, []).append(entry)

        def hydrate_token(token: ReadingToken) -> ReadingToken:
            if not isinstance(token, ReadingWord):
                return token
            entry = known_index.get(token.text)
            if entry is None:
                candidates = candidates_by_word.get(token.text, [])
                entry = candidates[0] if candidates else None
            return replace(
                token,
                pinyin=entry.pinyin if entry else None,
                definitions=entry.definitions if entry else (),
                dictionary_entry_id=entry.id if entry else None,
            )

        return [
            replace(item, reading=replace(item.reading, tokens=tuple(hydrate_token(t) for t in item.reading.tokens)))
            for item in items
        ]

    async def _resolve(
        self,
        segmented: tuple[SegmentedToken, ...],
        known_index: dict[str, DictionaryEntry],
        *,
        allowed_extra: frozenset[str] = frozenset(),
    ) -> tuple[ReadingToken, ...]:
        cache: dict[str, DictionaryEntry | None] = {}
        return tuple(await self._resolve_run(segmented, known_index, cache, allowed_extra, speaker=None))

    async def _resolve_dialogue(
        self,
        lines: tuple[DialogueLine, ...],
        known_index: dict[str, DictionaryEntry],
        allowed_extra: frozenset[str],
    ) -> tuple[ReadingToken, ...]:
        cache: dict[str, DictionaryEntry | None] = {}
        tokens: list[ReadingToken] = []
        for index, line in enumerate(lines):
            segmented = self._segmenter.segment(line.text)
            tokens.extend(await self._resolve_run(segmented, known_index, cache, allowed_extra, speaker=line.speaker))
            if index < len(lines) - 1:
                tokens.append(ReadingPunctuation(text="\n", speaker=line.speaker))
        return tuple(tokens)

    async def _resolve_run(
        self,
        segmented: tuple[SegmentedToken, ...],
        known_index: dict[str, DictionaryEntry],
        cache: dict[str, DictionaryEntry | None],
        allowed_extra: frozenset[str],
        *,
        speaker: str | None,
    ) -> list[ReadingToken]:
        out: list[ReadingToken] = []
        for token in segmented:
            if not is_chinese_word(token.text):
                out.append(ReadingPunctuation(text=token.text, speaker=speaker))
                continue

            entry = known_index.get(token.text)
            is_extra = entry is None and token.text not in allowed_extra
            if entry is None:
                if token.text not in cache:
                    candidates = await self._dictionary.find_by_simplified(token.text)
                    cache[token.text] = candidates[0] if candidates else None
                entry = cache[token.text]

            out.append(
                ReadingWord(
                    text=token.text,
                    pinyin=entry.pinyin if entry else None,
                    definitions=entry.definitions if entry else (),
                    part_of_speech=token.part_of_speech,
                    is_extra=is_extra,
                    dictionary_entry_id=entry.id if entry else None,
                    speaker=speaker,
                )
            )
        return out


def _choose_attempt(attempts: list[GenerationAttempt], max_extra_words: int) -> int:
    """Index of the draft that becomes the reading: the first one within the
    extra-word budget and free of dialogue problems, or — if none is — the
    least-bad one (no dialogue problem first, then fewest violations, most
    recent wins a tie)."""
    for i, attempt in enumerate(attempts):
        if len(attempt.extra_words) <= max_extra_words and not attempt.dialogue_problems:
            return i
    return min(
        range(len(attempts)),
        key=lambda i: (bool(attempts[i].dialogue_problems), len(attempts[i].extra_words), -i),
    )
