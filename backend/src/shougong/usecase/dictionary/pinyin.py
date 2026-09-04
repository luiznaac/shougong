"""Pinyin format validation and normalisation.

CC-CEDICT writes pinyin with mixed case (proper nouns are capitalised, e.g.
``Bei3 jing1``) and spells ü as the digraph ``u:`` (``lu:4 xing2``). Every
stored `dictionary_entry.pinyin` is normalised on import (see
`sanitize_pinyin`): lower-cased, ü written as ``v`` (``lv4 xing2``) — one
predictable shape to search and match against.

The batch importer matches CSV rows against that stored shape, so it first
checks the row is numbered-tone pinyin at all (`is_numbered_pinyin` — this
only *validates*, it never rewrites) and then sanitises it the same way
before comparing.
"""

from __future__ import annotations

import re

# One syllable: pinyin letters (``u:`` stands in for ü, as in CC-CEDICT) then a
# tone digit 1-5 (5 = neutral). Syllables are joined by a single space.
_SYLLABLE = r"[a-zA-Z:]+[1-5]"
_NUMBERED_PINYIN = re.compile(rf"{_SYLLABLE}(?: {_SYLLABLE})*")


def is_numbered_pinyin(value: str) -> bool:
    """True when ``value`` is numbered-tone pinyin (``"xue2 xi2"``), else False."""
    return bool(_NUMBERED_PINYIN.fullmatch(value))


def sanitize_pinyin(value: str) -> str:
    """Lower-case ``value`` and rewrite ü (``u:`` or the literal ``ü``) as ``v``."""
    return value.lower().replace("u:", "v").replace("ü", "v")
