"""ORM entities for the dictionary slice.

`dictionary_entry` is the lexicon: `definitions` is a JSON array of English glosses; `pos_tags` a
JSON array of community POS tags. `hsk_level` (official HSK 3.0 vocabulary level, or NULL outside
the list) and `pos_tags` are filled by the versioned enrichment pass and are the same on every row
that shares a `simplified`.

`dictionary_enrichment_state` is the single-row marker recording which enrichment version last
stamped the table. Add a migration (`uv run poe migrate:generate`) alongside any change here — see
backend/AGENTS.md.
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
    # Empty until the HSK enrichment pass (matches the migration's DEFAULT).
    pos_tags: Mapped[list[str]] = mapped_column(JSON, server_default=text("(JSON_ARRAY())"))


class DictionaryEnrichmentStateEntity(Base):
    """The single enrichment-version marker row.

    `id` is always 1: the pass upserts this row, so the table holds at most one
    version for the whole dictionary. `level_totals` records the official
    per-level word counts the pass saw, keyed by level (``"1"``..``"7"``), so the
    proficiency denominator is the official list's, not the dictionary subset's.
    """

    __tablename__ = "dictionary_enrichment_state"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    version: Mapped[int] = mapped_column(Integer)
    level_totals: Mapped[dict[str, int] | None] = mapped_column(JSON, nullable=True)
