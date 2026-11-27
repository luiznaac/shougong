"""Dictionary domain model.

A `DictionaryEntry` is one CC-CEDICT record, trimmed to what this app needs:
the simplified form, its pinyin, and the English glosses. Traditional forms are
deliberately dropped — this trainer only drills simplified handwriting.
"""

from __future__ import annotations

import collections
import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field

# The grouping key of a dictionary search row: one word and one of its readings.
type WordReading = tuple[str, str]

# The marker a variant gloss carries. Only the primary (first) gloss is checked:
# CC-CEDICT lists the primary sense first, so a real entry that merely notes a
# variant further down (了 liao3 "to finish ... variant of 瞭") stays real.
_VARIANT_MARKER = re.compile(r"variant of\b|erhua form of\b", re.IGNORECASE)

# A CC-CEDICT surname gloss ("surname He") marks the capitalized proper-noun row
# that shares a hanzi and a sanitised reading with the common word.
_SURNAME_GLOSS = re.compile(r"^surname \S", re.IGNORECASE)


def is_variant_gloss(definitions: tuple[str, ...]) -> bool:
    """True when the record's primary gloss only points at another form."""
    return bool(definitions) and _VARIANT_MARKER.search(definitions[0]) is not None


def is_surname_entry(definitions: tuple[str, ...]) -> bool:
    """True when any gloss is a CC-CEDICT `surname X` proper-noun gloss.

    Stored pinyin is lower-cased at import, so a surname row such as `San1
    /surname San/` collides with the common `san1 /three/`. The surname gloss is
    the remaining signal that the row is a proper noun.
    """
    return any(_SURNAME_GLOSS.match(gloss.strip()) for gloss in definitions)


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
class DictionaryMeaning:
    """One CC-CEDICT record's sense of a word, addressed by its own entry id."""

    entry_id: int
    definitions: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class DictionaryWordGroup:
    """One search result: a word and one of its readings, with every meaning.

    A different reading of the same hanzi is a different group. The word-level
    fields are shared by every entry in the group, since the enrichment pass
    stamps them by simplified form.
    """

    simplified: str
    pinyin: str
    hsk_level: int | None
    pos_tags: tuple[str, ...]
    handwriting_level: int | None
    meanings: tuple[DictionaryMeaning, ...]


def group_entries(entries: Sequence[DictionaryEntry]) -> list[DictionaryWordGroup]:
    """Group entries by `(simplified, pinyin)`, one group per word and reading.

    The result keeps the search order — shortest word first, then the group's
    first entry id — mirroring `DictionaryRepository.search`'s SQL ordering, so a
    repository can assemble a page it already ordered.

    Args:
        entries: The matching entries, in any order.

    Returns:
        One group per `(simplified, pinyin)`, its meanings ordered by entry id.
    """
    grouped: dict[WordReading, list[DictionaryEntry]] = collections.defaultdict(list)
    for entry in entries:
        grouped[(entry.simplified, entry.pinyin)].append(entry)

    def order(key: WordReading) -> tuple[int, int]:
        return len(key[0]), min(entry.id for entry in grouped[key])

    groups: list[DictionaryWordGroup] = []
    for key in sorted(grouped, key=order):
        members = sorted(grouped[key], key=lambda entry: entry.id)
        first = members[0]
        groups.append(
            DictionaryWordGroup(
                simplified=first.simplified,
                pinyin=first.pinyin,
                hsk_level=first.hsk_level,
                pos_tags=first.pos_tags,
                handwriting_level=first.handwriting_level,
                meanings=tuple(
                    DictionaryMeaning(entry_id=entry.id, definitions=entry.definitions) for entry in members
                ),
            )
        )
    return groups


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
