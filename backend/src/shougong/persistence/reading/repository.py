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
    PartOfSpeech,
    ReadingFormat,
    ReadingPunctuation,
    ReadingRequest,
    ReadingToken,
    ReadingWord,
    SavedReadingText,
)


def _naive_utc(value: datetime) -> datetime:
    return value.astimezone(UTC).replace(tzinfo=None)


def _as_utc(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def _token_to_json(token: ReadingToken) -> dict[str, Any]:
    if isinstance(token, ReadingWord):
        return {
            "is_word": True,
            "text": token.text,
            "part_of_speech": token.part_of_speech.value if token.part_of_speech is not None else None,
            "is_extra": token.is_extra,
        }
    return {"is_word": False, "text": token.text}


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
    if not row["is_word"]:
        return ReadingPunctuation(text=row["text"])
    return ReadingWord(
        text=row["text"],
        # Not stored — ReadingService re-resolves these from the dictionary
        # (batched, by word text) whenever history is read; see the module docstring.
        pinyin=None,
        definitions=(),
        part_of_speech=_parse_part_of_speech(row["part_of_speech"]),
        is_extra=row["is_extra"],
        dictionary_entry_id=None,
    )


def to_domain(row: ReadingTextEntity) -> SavedReadingText:
    request = ReadingRequest(
        format=ReadingFormat(row.format),
        max_extra_words=row.max_extra_words,
        model=row.model,
        topic=row.topic,
    )
    reading = GeneratedReading(
        format=ReadingFormat(row.format),
        tokens=tuple(_token_from_json(t) for t in row.tokens),
        known_word_count=row.known_word_count,
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
                topic=request.topic,
                model=request.model,
                known_word_count=reading.known_word_count,
                tokens=[_token_to_json(t) for t in reading.tokens],
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
