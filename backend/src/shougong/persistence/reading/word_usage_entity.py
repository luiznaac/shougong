"""ORM entity for the `reading_word_usage` table.

One row per word that has appeared in a generated reading: how many times, and when it last
did — the working-set sampler down-weights recently used words. Add a migration
(`uv run poe migrate:generate`) alongside any change here — see backend/AGENTS.md.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Integer, String, text
from sqlalchemy.dialects.mysql import DATETIME
from sqlalchemy.orm import Mapped, mapped_column

from shougong.persistence.configuration.base import Base

# microsecond precision, matching the DATETIME(6) columns Alembic's migrations declare.
_Timestamp = DATETIME(fsp=6)


class ReadingWordUsageEntity(Base):
    __tablename__ = "reading_word_usage"

    simplified: Mapped[str] = mapped_column(String(64), primary_key=True)
    uses: Mapped[int] = mapped_column(Integer, server_default=text("0"))
    last_used_at: Mapped[datetime | None] = mapped_column(_Timestamp)
