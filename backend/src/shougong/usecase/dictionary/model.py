"""Dictionary domain model.

A `DictionaryEntry` is one CC-CEDICT record, trimmed to what this app needs:
the simplified form, its pinyin, and the English glosses. Traditional forms are
deliberately dropped — this trainer only drills simplified handwriting.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class DictionaryEntry:
    id: int
    simplified: str
    pinyin: str
    definitions: tuple[str, ...]
    # Filled by the one-off HSK enrichment pass; the same on every entry that
    # shares a `simplified`. `hsk_level` is None for words outside the HSK list.
    hsk_level: int | None = None
    pos_tags: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class CedictRecord:
    """A parsed CC-CEDICT line, before it is persisted (no id yet)."""

    simplified: str
    pinyin: str
    definitions: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class HskDatasetWord:
    """One word from the HSK dataset — its level and raw POS tags. Used only to
    enrich `dictionary_entry`; not persisted as-is."""

    simplified: str
    hsk_level: int | None
    pos_tags: tuple[str, ...]
