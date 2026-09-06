"""ORM entity for the `reading_topic` table.

Keep this in sync with `mysql/init.sql` (which also seeds the starter scenarios).
Each row is one scenario the generator can draw from when the free-text topic is
blank; `active=0` keeps a scenario in the list but out of the draw.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, String, text
from sqlalchemy.orm import Mapped, mapped_column

from shougong.persistence.configuration.base import Base


class ReadingTopicEntity(Base):
    __tablename__ = "reading_topic"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    scenario: Mapped[str] = mapped_column(String(255), unique=True)
    active: Mapped[bool] = mapped_column(Boolean, server_default=text("1"))
    created_at: Mapped[datetime] = mapped_column(DateTime)
