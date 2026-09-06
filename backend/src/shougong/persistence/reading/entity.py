"""ORM entity for the `reading_text` table.

Keep this in sync with `mysql/init.sql`. `tokens` is a JSON array of the fully
resolved per-token result (word or punctuation) — stored as shown, not
recomputed against the live dictionary/vocabulary on every read, so a saved
reading stays exactly as it was generated even if the learner's vocabulary
changes later.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, BigInteger, Boolean, DateTime, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column

from shougong.persistence.configuration.base import Base


class ReadingTextEntity(Base):
    __tablename__ = "reading_text"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    format: Mapped[str] = mapped_column(String(16))
    max_extra_words: Mapped[int] = mapped_column(Integer)
    topic: Mapped[str | None] = mapped_column(String(255))
    # True when the service drew the topic from `reading_topic` (blank free text).
    topic_generated: Mapped[bool] = mapped_column(Boolean, server_default=text("0"))
    # Empty string on rows written before per-request model choice existed
    # (matches the `DEFAULT ''` in mysql/init.sql).
    model: Mapped[str] = mapped_column(String(128), server_default=text("''"))
    known_word_count: Mapped[int] = mapped_column(Integer)
    tokens: Mapped[list[dict[str, object]]] = mapped_column(JSON)
    # The full generation trail: every draft the correction loop produced (kept
    # even when discarded), one flagged `chosen`. Empty `[]` on rows written
    # before the loop existed (matches `DEFAULT (JSON_ARRAY())` in init.sql).
    attempts: Mapped[list[dict[str, object]]] = mapped_column(JSON, server_default=text("(JSON_ARRAY())"))
    # The vocabulary offered to the model: {group label: [words]} plus the
    # must-use anchors. Empty on rows written before working sets existed.
    working_set: Mapped[dict[str, list[str]]] = mapped_column(JSON, server_default=text("(JSON_OBJECT())"))
    must_use: Mapped[list[str]] = mapped_column(JSON, server_default=text("(JSON_ARRAY())"))
    created_at: Mapped[datetime] = mapped_column(DateTime, index=True)
