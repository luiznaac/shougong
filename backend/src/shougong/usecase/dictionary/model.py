"""Dictionary domain model.

A `DictionaryEntry` is one CC-CEDICT record, trimmed to what this app needs:
the simplified form, its pinyin, and the English glosses. Traditional forms are
deliberately dropped — this trainer only drills simplified handwriting.
"""

from __future__ import annotations

import re
from collections.abc import Mapping
from dataclasses import dataclass, field

# The marker a variant gloss carries. Only the primary (first) gloss is checked:
# CC-CEDICT lists the primary sense first, so a real entry that merely notes a
# variant further down (了 liao3 "to finish ... variant of 瞭") stays real.
_VARIANT_MARKER = re.compile(r"variant of\b|erhua form of\b", re.IGNORECASE)


def is_variant_gloss(definitions: tuple[str, ...]) -> bool:
    """True when the record's primary gloss only points at another form."""
    return bool(definitions) and _VARIANT_MARKER.search(definitions[0]) is not None


@dataclass(frozen=True, slots=True)
class DictionaryEntry:
    id: int
    simplified: str
    pinyin: str
    definitions: tuple[str, ...]
    # Filled by the versioned HSK enrichment pass; the same on every entry that
    # shares a `simplified`. `hsk_level` is the word's vocabulary level and is
    # None for words outside the HSK list; `handwriting_level` is derived as the
    # max writing level of the word's characters and is None when none has one.
    hsk_level: int | None = None
    pos_tags: tuple[str, ...] = ()
    handwriting_level: int | None = None


@dataclass(frozen=True, slots=True)
class RelatedEntry:
    """An entry sharing at least one hanzi with a target word, plus the id of
    the study item queuing it — `None` when the word is not queued."""

    entry: DictionaryEntry
    study_item_id: int | None = None


# One page of related entries, plus the family's total size.
type RelatedEntryPage = tuple[list[RelatedEntry], int]


@dataclass(frozen=True, slots=True)
class CedictRecord:
    """A parsed CC-CEDICT line, before it is persisted (no id yet).

    `is_variant` marks an alias row whose primary gloss only points at another
    form of the same word. It is derived from `definitions` at construction, so a
    record can never carry a stale mark and the import and cleanup policies agree."""

    simplified: str
    pinyin: str
    definitions: tuple[str, ...]
    is_variant: bool = field(init=False)

    def __post_init__(self) -> None:
        object.__setattr__(self, "is_variant", is_variant_gloss(self.definitions))


@dataclass(frozen=True, slots=True)
class HskDatasetWord:
    """One enriched dictionary word — the official vocabulary level joined to the
    community POS tags. Used only to stamp `dictionary_entry`; not persisted as-is."""

    simplified: str
    hsk_level: int | None
    pos_tags: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class HskCharacter:
    """One character from the official HSK 3.0 handwriting list, with the level
    at which it is expected to be written (the 7-9 band is stored as 7). Used
    only to enrich the character-level store; not persisted as-is."""

    character: str
    writing_level: int


def derive_handwriting_level(simplified: str, character_levels: Mapping[str, int]) -> int | None:
    """The max writing level among the word's characters that have one.

    A word is hand-writable only once every character in it is, so the rollup is
    the maximum rather than the minimum. Characters outside the writing list are
    ignored; a word with no levelled character has no handwriting level.

    Args:
        simplified: The word, as its run of simplified characters.
        character_levels: Character → writing level, for the characters that have one.

    Returns:
        The maximum writing level found, or None when no character has one.
    """
    levels = [character_levels[character] for character in simplified if character in character_levels]
    return max(levels) if levels else None
