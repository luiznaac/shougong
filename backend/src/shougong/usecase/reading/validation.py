"""Word-level vocabulary validation — pure, stdlib only.

A word is checked as a whole string against the known-vocabulary set, never
decomposed into characters: knowing "人" and "工" individually does not mean
"人工" is known.
"""

from __future__ import annotations

import re
from collections.abc import Iterable

_CJK = re.compile(r"^[一-鿿]+$")


def is_chinese_word(token: str) -> bool:
    return bool(_CJK.fullmatch(token))


def distinct_extra_words(tokens: Iterable[str], known_words: frozenset[str]) -> tuple[str, ...]:
    """Distinct out-of-vocabulary words, in first-seen order. Non-Chinese tokens
    (punctuation, whitespace) are ignored."""
    return tuple(dict.fromkeys(t for t in tokens if is_chinese_word(t) and t not in known_words))
