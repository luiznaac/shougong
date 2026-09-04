"""Pinyin normalisation for stored dictionary entries.

CC-CEDICT writes pinyin with mixed case (proper nouns are capitalised, e.g.
``Bei3 jing1``) and spells ü as the digraph ``u:`` (``lu:4 xing2``). We store it
lower-cased and with ü written as ``v`` (``lv4 xing2``) so every entry has a
single, predictable shape to search and match against.
"""

from __future__ import annotations


def sanitize_pinyin(value: str) -> str:
    """Lower-case ``value`` and rewrite ü (``u:`` or the literal ``ü``) as ``v``."""
    return value.lower().replace("u:", "v").replace("ü", "v")
