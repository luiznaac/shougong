"""`ReadingHistoryRepository` — implements `IReadingHistoryRepository` against MySQL.

Each resolved token is serialised to a small JSON dict (word and punctuation
tokens share a shape, discriminated by `is_word`). Only the segmented word
text, its part of speech, and whether it was extra are stored — no pinyin,
definitions, or dictionary id. `ReadingService` re-resolves those (batched, by
word text via `IDictionaryRepository.find_by_simplified_many`) whenever
history is read, so a listed reading always reflects the dictionary's (and
the study queue's) current content rather than a frozen copy from generation
time.
"""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime
from typing import Any

from sqlalchemy import func, select

from shougong.persistence.configuration.time import as_utc as _as_utc
from shougong.persistence.configuration.time import naive_utc as _naive_utc
from shougong.persistence.configuration.transaction import (
    SqlAlchemyTransactionTemplate,
    current_session,
)
from shougong.persistence.reading.entity import ReadingTextEntity
from shougong.usecase.reading.gateway import IReadingHistoryRepository
from shougong.usecase.reading.model import (
    GeneratedReading,
    GenerationAttempt,
    PartOfSpeech,
    ReadingFormat,
    ReadingPunctuation,
    ReadingRequest,
    ReadingSpeaker,
    ReadingSummary,
    ReadingToken,
    ReadingWord,
    SavedReadingText,
)
from shougong.usecase.reading.summary import extra_word_count, match_snippet, preview


def _optional_str(value: Any) -> str | None:
    return None if value is None else str(value)


def _token_to_json(token: ReadingToken) -> dict[str, Any]:
    if isinstance(token, ReadingWord):
        row: dict[str, Any] = {
            "is_word": True,
            "text": token.text,
            "part_of_speech": token.part_of_speech.value if token.part_of_speech is not None else None,
            "is_extra": token.is_extra,
        }
    else:
        row = {"is_word": False, "text": token.text}
    if token.speaker is not None:
        row["speaker"] = token.speaker
    return row


def _parse_part_of_speech(value: str | None) -> PartOfSpeech | None:
    if value is None:
        return None
    try:
        return PartOfSpeech(value)
    except ValueError:
        # A row written before PartOfSpeech's vocabulary last changed — drop the
        # label rather than fail the whole list; nothing else depends on it.
        return None


def _token_from_json(row: dict[str, Any]) -> ReadingToken:
    speaker = row.get("speaker")
    if not row["is_word"]:
        return ReadingPunctuation(text=row["text"], speaker=speaker)
    return ReadingWord(
        text=row["text"],
        # Not stored — ReadingService re-resolves these from the dictionary
        # (batched, by word text) whenever history is read; see the module docstring.
        pinyin=None,
        definitions=(),
        part_of_speech=_parse_part_of_speech(row["part_of_speech"]),
        is_extra=row["is_extra"],
        dictionary_entry_id=None,
        speaker=speaker,
    )


def _attempt_to_json(index: int, attempt: GenerationAttempt) -> dict[str, Any]:
    return {
        "attempt": index + 1,
        "text": attempt.text,
        "segmentation": list(attempt.segmentation),
        "extra_words": list(attempt.extra_words),
        "prompt_tokens": attempt.prompt_tokens,
        "completion_tokens": attempt.completion_tokens,
        "chosen": attempt.chosen,
        "dialogue_problems": list(attempt.dialogue_problems),
    }


def _attempt_from_json(row: dict[str, Any]) -> GenerationAttempt:
    return GenerationAttempt(
        text=row["text"],
        segmentation=tuple(row["segmentation"]),
        extra_words=tuple(row["extra_words"]),
        prompt_tokens=row["prompt_tokens"],
        completion_tokens=row["completion_tokens"],
        chosen=row["chosen"],
        dialogue_problems=tuple(row.get("dialogue_problems") or []),
    )


def to_domain(row: ReadingTextEntity) -> SavedReadingText:
    request = ReadingRequest(
        format=ReadingFormat(row.format),
        max_extra_words=row.max_extra_words,
        model=row.model,
        topic=row.topic,
        topic_generated=row.topic_generated,
        max_attempts=row.max_attempts,
    )
    reading = GeneratedReading(
        format=ReadingFormat(row.format),
        tokens=tuple(_token_from_json(t) for t in row.tokens),
        known_word_count=row.known_word_count,
        attempts=tuple(_attempt_from_json(a) for a in (row.attempts or [])),
        working_set={group: tuple(words) for group, words in (row.working_set or {}).items()},
        must_use=tuple(row.must_use or []),
        speakers=tuple(
            ReadingSpeaker(name=str(s["name"]), pinyin=_optional_str(s.get("pinyin"))) for s in (row.speakers or [])
        ),
    )
    return SavedReadingText(id=row.id, request=request, reading=reading, created_at=_as_utc(row.created_at))


def _summary(row: ReadingTextEntity, tokens: tuple[ReadingToken, ...], *, match_text: str | None) -> ReadingSummary:
    attempts = tuple(_attempt_from_json(a) for a in (row.attempts or []))
    return ReadingSummary(
        id=row.id,
        format=ReadingFormat(row.format),
        topic=row.topic,
        topic_generated=row.topic_generated,
        model=row.model,
        extra_word_count=extra_word_count(tokens, attempts),
        token_count=len(tokens),
        attempt_count=len(attempts) or 1,
        created_at=_as_utc(row.created_at),
        preview=preview(tokens),
        match=None if match_text is None else match_snippet(tokens, match_text),
    )


def to_entity(request: ReadingRequest, reading: GeneratedReading, created_at: datetime) -> ReadingTextEntity:
    """Build the `reading_text` row a saved reading serialises to.

    Kept public so the dev-only acceptance fixture persists a reading through
    the same mapping instead of re-spelling the entity's fields.

    Args:
        request: The generation request that produced the reading.
        reading: The resolved tokens and attempt trail to store.
        created_at: The generation instant, stored as naive UTC.

    Returns:
        The unsaved `ReadingTextEntity`.
    """
    return ReadingTextEntity(
        format=request.format.value,
        max_extra_words=request.max_extra_words,
        max_attempts=request.max_attempts,
        topic=request.topic,
        topic_generated=request.topic_generated,
        model=request.model,
        known_word_count=reading.known_word_count,
        tokens=[_token_to_json(t) for t in reading.tokens],
        attempts=[_attempt_to_json(i, a) for i, a in enumerate(reading.attempts)],
        working_set={group: list(words) for group, words in reading.working_set.items()},
        must_use=list(reading.must_use),
        speakers=[{"name": s.name, "pinyin": s.pinyin} for s in reading.speakers],
        created_at=_naive_utc(created_at),
    )


class ReadingHistoryRepository(IReadingHistoryRepository):
    def __init__(self, transaction_template: SqlAlchemyTransactionTemplate) -> None:
        self._tx = transaction_template

    async def save(self, request: ReadingRequest, reading: GeneratedReading, created_at: datetime) -> SavedReadingText:
        async def _run() -> SavedReadingText:
            session = current_session()
            row = to_entity(request, reading, created_at)
            session.add(row)
            await session.flush()
            return SavedReadingText(id=row.id, request=request, reading=reading, created_at=created_at)

        return await self._tx.execute(_run)

    async def list(self, *, limit: int, offset: int) -> list[SavedReadingText]:
        async def _run() -> list[SavedReadingText]:
            session = current_session()
            stmt = (
                select(ReadingTextEntity)
                .order_by(ReadingTextEntity.created_at.desc(), ReadingTextEntity.id.desc())
                .limit(limit)
                .offset(offset)
            )
            rows = (await session.execute(stmt)).scalars().all()
            return [to_domain(row) for row in rows]

        return await self._tx.execute(_run)

    async def get(self, reading_id: int) -> SavedReadingText | None:
        async def _run() -> SavedReadingText | None:
            session = current_session()
            row = await session.get(ReadingTextEntity, reading_id)
            return to_domain(row) if row is not None else None

        return await self._tx.execute(_run)

    async def list_summaries(
        self, *, limit: int, offset: int, match_text: str | None = None
    ) -> tuple[Sequence[ReadingSummary], int]:
        """Summary rows, newest first, plus the exact total of the matching set.

        The stored `tokens` JSON holds word text only, so an `entry_id` filter
        is resolved by the service to the one word text that hydration picks and
        matched here against that text — the token JSON is scanned rather than
        adding a stored `dictionary_entry_id` column (see the build ticket).
        """
        stmt = select(ReadingTextEntity).order_by(ReadingTextEntity.created_at.desc(), ReadingTextEntity.id.desc())

        async def _run() -> tuple[Sequence[ReadingSummary], int]:
            session = current_session()
            if match_text is not None:
                rows = (await session.execute(stmt)).scalars().all()
                parsed = [(row, tuple(_token_from_json(t) for t in row.tokens)) for row in rows]
                matched = [(row, tokens) for row, tokens in parsed if match_snippet(tokens, match_text) is not None]
                return (
                    [_summary(row, tokens, match_text=match_text) for row, tokens in matched[offset : offset + limit]],
                    len(matched),
                )
            total = int(await session.scalar(select(func.count()).select_from(ReadingTextEntity)) or 0)
            rows = (await session.execute(stmt.limit(limit).offset(offset))).scalars().all()
            return [
                _summary(row, tuple(_token_from_json(t) for t in row.tokens), match_text=None) for row in rows
            ], total

        return await self._tx.execute(_run)
