"""ORM entity for the `study_item` table. Keep in sync with `mysql/init.sql`.

The FSRS card is flattened into `card_*` columns; `card_due` is indexed for the
"what's due now" query. Datetimes are stored as naive UTC (MySQL has no tz).
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, Double, ForeignKey, Integer, SmallInteger
from sqlalchemy.dialects.mysql import DATETIME
from sqlalchemy.orm import Mapped, mapped_column

from shougong.persistence.configuration.base import Base

# microsecond precision — FSRS due times are compared against "now"
_Timestamp = DATETIME(fsp=6)


class StudyItemEntity(Base):
    __tablename__ = "study_item"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    entry_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("dictionary_entry.id", ondelete="CASCADE"),
        unique=True,
    )
    card_state: Mapped[int] = mapped_column(SmallInteger)
    card_step: Mapped[int | None] = mapped_column(Integer)
    card_stability: Mapped[float | None] = mapped_column(Double)
    card_difficulty: Mapped[float | None] = mapped_column(Double)
    card_due: Mapped[datetime] = mapped_column(_Timestamp, index=True)
    card_last_review: Mapped[datetime | None] = mapped_column(_Timestamp)
    created_at: Mapped[datetime] = mapped_column(_Timestamp)
