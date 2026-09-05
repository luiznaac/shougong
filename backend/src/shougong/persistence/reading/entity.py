"""ORM entity for the `reading_text` table.

Keep this in sync with `mysql/init.sql`. `tokens` is a JSON array of the fully
resolved per-token result (word or punctuation) — stored as shown, not
recomputed against the live dictionary/vocabulary on every read, so a saved
reading stays exactly as it was generated even if the learner's vocabulary
changes later.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, BigInteger, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from shougong.persistence.configuration.base import Base


class ReadingTextEntity(Base):
    __tablename__ = "reading_text"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    format: Mapped[str] = mapped_column(String(16))
    max_extra_words: Mapped[int] = mapped_column(Integer)
    topic: Mapped[str | None] = mapped_column(String(255))
    extra_word_count: Mapped[int] = mapped_column(Integer)
    extra_char_count: Mapped[int] = mapped_column(Integer)
    known_word_count: Mapped[int] = mapped_column(Integer)
    known_words_char_count: Mapped[int] = mapped_column(Integer)
    tokens: Mapped[list[dict[str, object]]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime, index=True)
