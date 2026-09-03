"""ORM entity for the `study_item_history` table. Keep in sync with `mysql/init.sql`.

`study_item_history` is an append-only trail of `study_item` state — the card columns
copied from `study_item` plus this row's own `created_at` — written when the item is
created and after every change. Datetimes are stored as naive UTC (MySQL has no tz).
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import BigInteger, Double, ForeignKey, Index, SmallInteger
from sqlalchemy.dialects.mysql import DATETIME
from sqlalchemy.orm import Mapped, mapped_column

from shougong.persistence.configuration.base import Base

# microsecond precision — matches the study_item card columns this mirrors
_Timestamp = DATETIME(fsp=6)


class StudyItemHistoryEntity(Base):
    """A row of `study_item` state, saved on creation and after every change.
    The `card_*` and `entry_id` columns mirror `StudyItemEntity`; `created_at` is
    when this history row was written and orders the trail."""

    __tablename__ = "study_item_history"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    study_item_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("study_item.id"))
    created_at: Mapped[datetime] = mapped_column(_Timestamp)
    entry_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("dictionary_entry.id"))
    card_state: Mapped[int] = mapped_column(SmallInteger)
    card_stability: Mapped[float | None] = mapped_column(Double)
    card_difficulty: Mapped[float | None] = mapped_column(Double)
    card_due: Mapped[datetime] = mapped_column(_Timestamp)
    card_last_review: Mapped[datetime | None] = mapped_column(_Timestamp)

    __table_args__ = (Index("ix_study_item_history_item_created", "study_item_id", "created_at"),)
