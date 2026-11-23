"""CC-CEDICT import policy — the set-level rule that trims variant and duplicate rows.

CC-CEDICT ships rows that collapse onto one simplified form: alias ("variant of
X") rows for orthographic variants, and byte-identical duplicates. This module
decides, over a whole set at once, which of those rows to drop so a common word
resolves to one entry while variant-only characters and genuine homographs stay.

A **variant** is a record whose primary gloss only points at another spelling or
form of the same word (`old variant of 寇`, `variant of 從|从`). CC-CEDICT lists
the primary sense first, so only the first gloss decides — a real entry that
merely notes a variant further down (`了` liao3 "to finish ... variant of 瞭")
stays a real entry.

The policy is set-level, not per-line: a variant is dropped only when the same
simplified form has a real (non-variant) entry, so a character that exists only
as a variant record stays searchable. Two rows are byte-identical duplicates when
their `duplicate_key` — the `(simplified, pinyin, definitions)` triple — matches.
Genuine homographs (same simplified and pinyin, different meanings) are distinct
keys and stay as separate rows.
"""

from __future__ import annotations

from collections.abc import Callable, Iterator, Sequence
from typing import Protocol

from shougong.usecase.dictionary.model import CedictRecord, DictionaryEntry, is_variant_gloss

# The byte-identical key: two rows with the same key are duplicates.
type DuplicateKey = tuple[str, str, tuple[str, ...]]


class DictionaryRow(Protocol):
    """The fields a row needs to take part in the policy — a `CedictRecord` before
    persistence or a `DictionaryEntry` read back from the database."""

    @property
    def simplified(self) -> str: ...

    @property
    def pinyin(self) -> str: ...

    @property
    def definitions(self) -> tuple[str, ...]: ...


def duplicate_key(row: DictionaryRow) -> DuplicateKey:
    """The byte-identical key: two rows with the same key are duplicates."""
    return (row.simplified, row.pinyin, row.definitions)


def _flagged[T: DictionaryRow](rows: Sequence[T], variant: Callable[[T], bool]) -> Iterator[tuple[T, bool]]:
    """Yield each row with whether the policy drops it.

    `variant` classifies a row, so a `CedictRecord` uses its parser-computed
    `is_variant` while a `DictionaryEntry` re-derives it from its definitions.
    """
    real_simplified = {row.simplified for row in rows if not variant(row)}
    seen: set[DuplicateKey] = set()
    for row in rows:
        key = duplicate_key(row)
        duplicate = key in seen
        seen.add(key)
        yield row, duplicate or (variant(row) and row.simplified in real_simplified)


def apply_import_policy(records: Sequence[CedictRecord]) -> list[CedictRecord]:
    """Drop variants that have a real sibling and byte-identical duplicates.

    Args:
        records: The parsed CC-CEDICT rows, in source order.

    Returns:
        The rows to persist: the first occurrence of each duplicate key, minus any
        variant whose simplified form also has a real entry.
    """
    return [record for record, dropped in _flagged(records, lambda row: row.is_variant) if not dropped]


def select_cleanup_ids(entries: Sequence[DictionaryEntry], protected: frozenset[int]) -> set[int]:
    """The stored entry ids the import policy would remove from an existing table.

    Applied by the versioned enrichment pass so an old database converges on the
    same rows a fresh import produces. A row a study item or its history references
    is never selected — deleting it would break that learner's queue.

    Args:
        entries: Every stored dictionary entry.
        protected: Entry ids referenced by a study item or its history.

    Returns:
        The ids to delete; kept rows keep their id.
    """
    ordered = sorted(entries, key=lambda entry: entry.id)
    return {
        entry.id
        for entry, dropped in _flagged(ordered, lambda row: is_variant_gloss(row.definitions))
        if dropped and entry.id not in protected
    }
