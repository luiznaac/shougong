"""Pure parsing of HanziHero's known-item CSV exports.

The first column of each export is the join key to `dictionary_entry.simplified`
— `character` for `characters.csv`, `word` for `words.csv`, `entry` for
`my-dictionary.csv` — and the reading lives in `numbered_pinyin`. Parsing is
header-driven, so a renamed or reordered column fails loudly instead of importing
garbage.

HanziHero writes numbered pinyin without syllable separators (`shou3gong1`) and
with `v` for ü (`nv3`); shougong stores it space-separated (`shou3 gong1`). The
transform below inserts a space after each tone digit, then normalises case and
ü exactly as the dictionary import does.
"""

from __future__ import annotations

import csv
import io
import re

from shougong.usecase.dictionary.pinyin import sanitize_pinyin
from shougong.usecase.hanzihero.model import (
    HanziHeroExportFormatError,
    HanziHeroExports,
    HanziHeroSyncRow,
)

CHARACTERS_JOIN = "character"
WORDS_JOIN = "word"
DICTIONARY_JOIN = "entry"

# A tone digit begins the next syllable when a letter follows it; this keeps a
# trailing digit (a single-syllable reading) and an already-spaced reading intact.
_TONE_BOUNDARY = re.compile(r"([1-5])(?=[a-zA-Z])")


def to_numbered_pinyin(raw: str) -> str:
    """Turn HanziHero's unspaced numbered pinyin into shougong's spaced syllables.

    ``shou3gong1`` -> ``shou3 gong1``; neutral tones and ``v`` for ü are kept,
    and ``u:``/``ü`` are normalised to ``v`` — the same shape the dictionary stores.
    """
    spaced = _TONE_BOUNDARY.sub(r"\1 ", raw.strip().lower())
    return sanitize_pinyin(spaced)


def parse_export(text: str, *, join_column: str) -> list[HanziHeroSyncRow]:
    """Parse one export into sync rows, dropping `skipped=true` rows.

    Args:
        text: The raw CSV body.
        join_column: The expected header of the first column (`character`,
            `word` or `entry`).

    Returns:
        One transformed row per non-skipped CSV record, in file order.

    Raises:
        HanziHeroExportFormatError: The header is missing the join column,
            `numbered_pinyin` or `skipped`.
    """
    reader = csv.DictReader(io.StringIO(text))
    fieldnames = reader.fieldnames or []
    if not fieldnames or fieldnames[0] != join_column:
        raise HanziHeroExportFormatError(
            f"HanziHero export must start with a '{join_column}' column; got {fieldnames or 'no header'}"
        )
    for required in ("numbered_pinyin", "skipped"):
        if required not in fieldnames:
            raise HanziHeroExportFormatError(f"HanziHero export is missing the '{required}' column")

    rows: list[HanziHeroSyncRow] = []
    for record in reader:
        if (record.get("skipped") or "").strip().lower() == "true":
            continue
        hanzi = (record.get(join_column) or "").strip()
        pinyin = to_numbered_pinyin(record.get("numbered_pinyin") or "")
        rows.append(HanziHeroSyncRow(hanzi=hanzi, pinyin=pinyin))
    return rows


def parse_exports(exports: HanziHeroExports) -> tuple[HanziHeroSyncRow, ...]:
    """Parse all three exports and dedupe by hanzi + reading, keeping first-seen order.

    Characters and words both map to dictionary entries, and a dictionary item can
    share a hanzi with a word export under the same reading; a row is identified by
    the pair the batch import matches on, so duplicates collapse here.
    """
    rows = [
        *parse_export(exports.characters, join_column=CHARACTERS_JOIN),
        *parse_export(exports.words, join_column=WORDS_JOIN),
        *parse_export(exports.dictionary, join_column=DICTIONARY_JOIN),
    ]
    seen: set[tuple[str, str]] = set()
    deduped: list[HanziHeroSyncRow] = []
    for row in rows:
        key = (row.hanzi, row.pinyin)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(row)
    return tuple(deduped)
