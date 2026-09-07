"""ORM entity for the `dictionary_entry` table.

Keep this in sync with `mysql/init.sql`. `definitions` is a JSON array of
English glosses; `pos_tags` a JSON array of raw HSK POS tags. `hsk_level` and
`pos_tags` are filled by the one-off HSK enrichment pass and are the same on
every row that shares a `simplified`.
"""

from __future__ import annotations

from sqlalchemy import JSON, BigInteger, Integer, String, text
from sqlalchemy.orm import Mapped, mapped_column

from shougong.persistence.configuration.base import Base


class DictionaryEntryEntity(Base):
    __tablename__ = "dictionary_entry"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    simplified: Mapped[str] = mapped_column(String(64), index=True)
    pinyin: Mapped[str] = mapped_column(String(191), index=True)
    definitions: Mapped[list[str]] = mapped_column(JSON)
    hsk_level: Mapped[int | None] = mapped_column(Integer, index=True)
    # Empty until the HSK enrichment pass (matches `DEFAULT (JSON_ARRAY())` in init.sql).
    pos_tags: Mapped[list[str]] = mapped_column(JSON, server_default=text("(JSON_ARRAY())"))
