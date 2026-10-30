"""ORM entities for the `study_item`, `review_log` and `study_item_priority` tables.

The FSRS card is flattened into `study_item.card_*` columns; `card_due` is indexed
for the "what's due now" query. `review_log` is the append-only history of grades.
`study_item_priority` holds one row per pinned item (row presence is membership) and
its signed `position` is the opaque display-ordering key.
The `study_item_history` trail lives in `persistence/study_item_history/`.
Datetimes are stored as naive UTC (MySQL has no tz). Add a migration alongside any change here —
see backend/AGENTS.md.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, Double, ForeignKey, Index, Integer, SmallInteger
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
        ForeignKey("dictionary_entry.id"),
        unique=True,
    )
    card_state: Mapped[int] = mapped_column(SmallInteger)
    card_stability: Mapped[float | None] = mapped_column(Double)
    card_difficulty: Mapped[float | None] = mapped_column(Double)
    card_due: Mapped[datetime] = mapped_column(_Timestamp, index=True)
    card_last_review: Mapped[datetime | None] = mapped_column(_Timestamp)
    created_at: Mapped[datetime] = mapped_column(_Timestamp)


class ReviewLogEntity(Base):
    __tablename__ = "review_log"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    study_item_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("study_item.id"))
    rating: Mapped[int] = mapped_column(SmallInteger)
    review_datetime: Mapped[datetime] = mapped_column(_Timestamp)

    __table_args__ = (Index("ix_review_log_study_item", "study_item_id"),)


class StudyItemPriorityEntity(Base):
    __tablename__ = "study_item_priority"

    # Row presence is membership: deleting it unpins the item, and deleting the
    # study item cascades.
    study_item_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("study_item.id", ondelete="CASCADE"),
        primary_key=True,
    )
    position: Mapped[int] = mapped_column(Integer, index=True)
