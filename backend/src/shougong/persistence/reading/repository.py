"""`ReadingHistoryRepository` — implements `IReadingHistoryRepository` against MySQL.

Each resolved token is serialised to a small JSON dict (word and punctuation
tokens share a shape, discriminated by `is_word`) so a saved reading can be
listed back without ever re-touching the dictionary or the learner's current
vocabulary.
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
            "pinyin": token.pinyin,
            "definitions": list(token.definitions),
            "part_of_speech": token.part_of_speech,
            "is_extra": token.is_extra,
            "dictionary_entry_id": token.dictionary_entry_id,
        }
    return {"is_word": False, "text": token.text}


def _token_from_json(row: dict[str, Any]) -> ReadingToken:
    if not row["is_word"]:
        return ReadingPunctuation(text=row["text"])
    return ReadingWord(
        text=row["text"],
        pinyin=row["pinyin"],
        definitions=tuple(row["definitions"]),
        part_of_speech=row["part_of_speech"],
        is_extra=row["is_extra"],
        dictionary_entry_id=row.get("dictionary_entry_id"),
    )


def to_domain(row: ReadingTextEntity) -> SavedReadingText:
    request = ReadingRequest(format=ReadingFormat(row.format), max_extra_words=row.max_extra_words, topic=row.topic)
    reading = GeneratedReading(
        format=ReadingFormat(row.format),
        tokens=tuple(_token_from_json(t) for t in row.tokens),
        extra_word_count=row.extra_word_count,
        extra_char_count=row.extra_char_count,
        known_word_count=row.known_word_count,
        known_words_char_count=row.known_words_char_count,
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
                extra_word_count=reading.extra_word_count,
                extra_char_count=reading.extra_char_count,
                known_word_count=reading.known_word_count,
                known_words_char_count=reading.known_words_char_count,
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
