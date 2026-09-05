"""Word-level vocabulary validation — pure, stdlib only.

A word is checked as a whole string against the known-vocabulary set, never
decomposed into characters: knowing "人" and "工" individually does not mean
"人工" is known.
"""

from __future__ import annotations

import re

_CJK = re.compile(r"^[一-鿿]+$")


def is_chinese_word(token: str) -> bool:
    return bool(_CJK.fullmatch(token))
