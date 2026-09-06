"""ORM entity for the `vocabulary_profile` table.

Keep this in sync with `mysql/init.sql`. One row per word in the learner's study
queue: its HSK level, raw HSK POS tags, and the broad `pos_category` derived from
them. `source` records where the row came from — `manual` rows are never
overwritten by a resync.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from shougong.persistence.configuration.base import Base


class VocabularyProfileEntity(Base):
    __tablename__ = "vocabulary_profile"

    simplified: Mapped[str] = mapped_column(String(64), primary_key=True)
    hsk_level: Mapped[int | None] = mapped_column(Integer)
    pos_tags: Mapped[list[str]] = mapped_column(JSON)
    pos_category: Mapped[str] = mapped_column(String(16))
    source: Mapped[str] = mapped_column(String(16))
    updated_at: Mapped[datetime] = mapped_column(DateTime)
