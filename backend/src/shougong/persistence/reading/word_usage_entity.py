"""ORM entity for the `reading_word_usage` table.

Keep this in sync with `mysql/init.sql`. One row per word that has appeared in a
generated reading: how many times, and when it last did — the working-set
sampler down-weights recently used words.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column

from shougong.persistence.configuration.base import Base


class ReadingWordUsageEntity(Base):
    __tablename__ = "reading_word_usage"

    simplified: Mapped[str] = mapped_column(String(64), primary_key=True)
    uses: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime)
