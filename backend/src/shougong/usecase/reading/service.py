"""`ReadingService` — generate a vocabulary-restricted reading text, validate it
locally against the learner's known words, and persist the result.

The LLM is only ever responsible for the running text, generated once (no
retry if it exceeds the requested extra-word budget — the actual extras are
just reported back, flagged per word). Segmentation, word-level vocabulary
validation, and pinyin/definitions all happen locally — the model never sees
or returns a translation, and never decides what counts as "known".
"""

from __future__ import annotations

from dataclasses import replace

from shougong.usecase.commons.time import IClock
from shougong.usecase.dictionary.gateway import IDictionaryRepository
from shougong.usecase.dictionary.model import DictionaryEntry
from shougong.usecase.reading.gateway import IReadingHistoryRepository, IReadingTextGateway, ISegmenter, SegmentedToken
from shougong.usecase.reading.model import (
    GeneratedReading,
    ReadingPunctuation,
    ReadingRequest,
    ReadingToken,
    ReadingWord,
    SavedReadingText,
)
from shougong.usecase.reading.validation import is_chinese_word
from shougong.usecase.study.gateway import IStudyItemRepository


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

        text = await self._gateway.generate(
            known_words=known_words,
            text_format=request.format,
            max_extra_words=request.max_extra_words,
            model=request.model,
            topic=request.topic,
        )
        segmented = self._segmenter.segment(text)

        reading = await self._resolve(request, segmented, known_index, known_word_count=len(known_words))
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
        request: ReadingRequest,
        segmented: tuple[SegmentedToken, ...],
        known_index: dict[str, DictionaryEntry],
        *,
        known_word_count: int,
    ) -> GeneratedReading:
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

        return GeneratedReading(format=request.format, tokens=tuple(tokens), known_word_count=known_word_count)
