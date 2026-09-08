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

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select

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
    ReadingToken,
    ReadingWord,
    SavedReadingText,
)


def _optional_str(value: Any) -> str | None:
    return None if value is None else str(value)


def _naive_utc(value: datetime) -> datetime:
    return value.astimezone(UTC).replace(tzinfo=None)


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


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


class ReadingHistoryRepository(IReadingHistoryRepository):
    def __init__(self, transaction_template: SqlAlchemyTransactionTemplate) -> None:
        self._tx = transaction_template

    async def save(self, request: ReadingRequest, reading: GeneratedReading, created_at: datetime) -> SavedReadingText:
        async def _run() -> SavedReadingText:
            session = current_session()
            row = ReadingTextEntity(
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
