"""ORM entity for the `dictionary_entry` table.

Keep this in sync with `mysql/init.sql`. `definitions` is a JSON array of
English glosses.
"""

from __future__ import annotations

from sqlalchemy import JSON, BigInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from shougong.persistence.configuration.base import Base


class DictionaryEntryEntity(Base):
    __tablename__ = "dictionary_entry"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    simplified: Mapped[str] = mapped_column(String(64), index=True)
    pinyin: Mapped[str] = mapped_column(String(191), index=True)
    definitions: Mapped[list[str]] = mapped_column(JSON)
