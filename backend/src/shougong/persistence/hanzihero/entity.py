"""ORM entity for the single-row `hanzihero_connection` table.

`id` is always `1`: the learner has one HanziHero account, and `save` merges over
that row. Only the authenticated session cookie and the connected/last-synced
instants are stored — never the email/username or password. Add a migration
alongside any change here — see backend/AGENTS.md.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Integer, Text
from sqlalchemy.dialects.mysql import DATETIME
from sqlalchemy.orm import Mapped, mapped_column

from shougong.persistence.configuration.base import Base

_Timestamp = DATETIME(fsp=6)


class HanziHeroConnectionEntity(Base):
    __tablename__ = "hanzihero_connection"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    session_cookie: Mapped[str] = mapped_column(Text)
    connected_at: Mapped[datetime] = mapped_column(_Timestamp)
    last_synced_at: Mapped[datetime | None] = mapped_column(_Timestamp)
