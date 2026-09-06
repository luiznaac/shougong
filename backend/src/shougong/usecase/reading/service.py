"""`ReadingService` — generate a vocabulary-restricted reading text, validate it
locally against the learner's known words, and persist the result.

The LLM is only ever responsible for the running text. It is asked once; if the
draft uses more distinct words outside the learner's vocabulary than requested,
those exact words are handed back and a rewrite is requested, up to
`_MAX_GENERATION_ATTEMPTS` times. Every draft — including the rejected ones — is
kept on the saved reading as an audit trail. Segmentation, word-level vocabulary
validation, and pinyin/definitions all happen locally — the model never sees or
returns a translation, and never decides what counts as "known".
"""

from __future__ import annotations

from dataclasses import replace

from shougong.usecase.commons.time import IClock
from shougong.usecase.dictionary.gateway import IDictionaryRepository
from shougong.usecase.dictionary.model import DictionaryEntry
from shougong.usecase.reading.gateway import (
    IReadingHistoryRepository,
    IReadingTextGateway,
    ISegmenter,
    RejectedDraft,
    SegmentedToken,
)
from shougong.usecase.reading.model import (
    GeneratedReading,
    GenerationAttempt,
    ReadingPunctuation,
    ReadingRequest,
    ReadingToken,
    ReadingWord,
    SavedReadingText,
)
from shougong.usecase.reading.validation import is_chinese_word, out_of_vocabulary
from shougong.usecase.study.gateway import IStudyItemRepository

_MAX_GENERATION_ATTEMPTS = 3


class ReadingService:
    def __init__(
        self,
        gateway: IReadingTextGateway,
        segmenter: ISegmenter,
        study_repository: IStudyItemRepository,
        dictionary_repository: IDictionaryRepository,
        history_repository: IReadingHistoryRepository,
        clock: IClock,
    ) -> None:
        self._gateway = gateway
        self._segmenter = segmenter
        self._study = study_repository
        self._dictionary = dictionary_repository
        self._history = history_repository
        self._clock = clock

    async def generate(self, request: ReadingRequest) -> SavedReadingText:
        known_index = await self._known_word_index()
        known_words = frozenset(known_index)

        attempts: list[GenerationAttempt] = []
        segmentations: list[tuple[SegmentedToken, ...]] = []
        prior: list[RejectedDraft] = []

        for _ in range(_MAX_GENERATION_ATTEMPTS):
            draft = await self._gateway.generate(
                known_words=known_words,
                text_format=request.format,
                max_extra_words=request.max_extra_words,
                model=request.model,
                topic=request.topic,
                prior_attempts=prior,
            )
            segmented = self._segmenter.segment(draft.text)
            extras = out_of_vocabulary([t.text for t in segmented], known_words)

            attempts.append(
                GenerationAttempt(
                    text=draft.text,
                    segmentation=tuple(t.text for t in segmented),
                    extra_words=tuple(extras),
                    prompt_tokens=draft.prompt_tokens,
                    completion_tokens=draft.completion_tokens,
                    chosen=False,
                )
            )
            segmentations.append(segmented)

            if len(extras) <= request.max_extra_words:
                break
            prior.append(RejectedDraft(draft=draft.text, rejected_words=tuple(extras)))

        chosen = _choose_attempt(attempts, request.max_extra_words)
        attempts[chosen] = replace(attempts[chosen], chosen=True)

        tokens = await self._resolve(segmentations[chosen], known_index)
        reading = GeneratedReading(
            format=request.format,
            tokens=tokens,
            known_word_count=len(known_words),
            attempts=tuple(attempts),
        )
        return await self._history.save(request, reading, self._clock.now())

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
    ) -> tuple[ReadingToken, ...]:
        resolved_cache: dict[str, DictionaryEntry | None] = {}
        tokens: list[ReadingToken] = []

        for token in segmented:
            if not is_chinese_word(token.text):
                tokens.append(ReadingPunctuation(text=token.text))
                continue

            entry = known_index.get(token.text)
            is_extra = entry is None
            if is_extra:
                if token.text not in resolved_cache:
                    candidates = await self._dictionary.find_by_simplified(token.text)
                    resolved_cache[token.text] = candidates[0] if candidates else None
                entry = resolved_cache[token.text]

            tokens.append(
                ReadingWord(
                    text=token.text,
                    pinyin=entry.pinyin if entry else None,
                    definitions=entry.definitions if entry else (),
                    part_of_speech=token.part_of_speech,
                    is_extra=is_extra,
                    dictionary_entry_id=entry.id if entry else None,
                )
            )

        return tuple(tokens)


def _choose_attempt(attempts: list[GenerationAttempt], max_extra_words: int) -> int:
    """Index of the draft that becomes the reading: the first one within the
    extra-word budget, or — if none is — the one with the fewest violations
    (the most recent wins a tie)."""
    for i, attempt in enumerate(attempts):
        if len(attempt.extra_words) <= max_extra_words:
            return i
    return min(range(len(attempts)), key=lambda i: (len(attempts[i].extra_words), -i))
