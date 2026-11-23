"""Dictionary domain model.

A `DictionaryEntry` is one CC-CEDICT record, trimmed to what this app needs:
the simplified form, its pinyin, and the English glosses. Traditional forms are
deliberately dropped — this trainer only drills simplified handwriting.
"""

from __future__ import annotations

import re
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
    # shares a `simplified`. `hsk_level` is None for words outside the HSK list.
    hsk_level: int | None = None
    pos_tags: tuple[str, ...] = ()


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
    """One word from the HSK dataset — its level and raw POS tags. Used only to
    enrich `dictionary_entry`; not persisted as-is."""

    simplified: str
    hsk_level: int | None
    pos_tags: tuple[str, ...]
