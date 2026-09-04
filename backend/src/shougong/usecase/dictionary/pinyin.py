"""Pinyin format validation.

The batch importer matches CSV rows against CC-CEDICT by *exact* pinyin string,
so the input has to be in the same shape CC-CEDICT stores: space-separated
syllables, each carrying a numeric tone (``xue2 xi2``, ``lu:4 xing2``). This
module only *checks* that shape — it never rewrites the value.
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
