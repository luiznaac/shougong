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


@dataclass(frozen=True, slots=True)
class CedictRecord:
    """A parsed CC-CEDICT line, before it is persisted (no id yet)."""

    simplified: str
    pinyin: str
    definitions: tuple[str, ...]
