"""ORM entity for the `reading_topic` table.

Each row is one scenario the generator can draw from when the free-text topic is blank;
`active=0` keeps a scenario in the list but out of the draw. The starter scenarios are seeded by
migration `0003_reading`; add a migration alongside any change here — see backend/CLAUDE.md §3.5.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, Boolean, String, text
from sqlalchemy.dialects.mysql import DATETIME
from sqlalchemy.orm import Mapped, mapped_column

from shougong.persistence.configuration.base import Base

# microsecond precision, matching the DATETIME(6) columns Alembic's migrations declare.
_Timestamp = DATETIME(fsp=6)


class ReadingTopicEntity(Base):
    __tablename__ = "reading_topic"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    scenario: Mapped[str] = mapped_column(String(255), unique=True)
    active: Mapped[bool] = mapped_column(Boolean, server_default=text("1"))
    created_at: Mapped[datetime] = mapped_column(_Timestamp)
