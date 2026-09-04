"""ORM entity for the `character_strokes` table.

Keep this in sync with `mysql/init.sql`. `character` is the primary key (not an
autoincrement id) since lookups are always by character. `has_data=False` rows
are a negative cache — a character with no stroke data upstream (e.g. punctuation)
— so a repeat lookup never re-hits the source.
"""

from __future__ import annotations

from sqlalchemy import JSON, Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from shougong.persistence.configuration.base import Base


class CharacterStrokesEntity(Base):
    __tablename__ = "character_strokes"

    character: Mapped[str] = mapped_column(String(8), primary_key=True)
    has_data: Mapped[bool] = mapped_column(Boolean)
    strokes: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    medians: Mapped[list[list[list[float]]] | None] = mapped_column(JSON, nullable=True)
