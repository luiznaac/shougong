"""Word-level vocabulary validation — pure, stdlib only.

A word is checked as a whole string against the known-vocabulary set, never
decomposed into characters: knowing "人" and "工" individually does not mean
"人工" is known.
"""

from __future__ import annotations

import re
from collections.abc import Sequence

_CJK = re.compile(r"^[一-鿿]+$")

# Upper bound on how many characters a single lexicon entry may span when
# reconstructing words with longest-match. Chinese words are almost always 1-4
# characters; 8 is a safe ceiling that keeps the scan cheap.
_MAX_WORD_LEN = 8


def is_chinese_word(token: str) -> bool:
    return bool(_CJK.fullmatch(token))


def out_of_vocabulary(token_texts: Sequence[str], known_words: frozenset[str]) -> list[str]:
    """Distinct words in the text that are not in ``known_words``, sorted.

    The segmenter's own tokens are only a starting point. Each maximal run of
    adjacent hanzi tokens is re-scanned with greedy longest-match against a
    lexicon of ``known_words`` plus every hanzi token the segmenter produced, so
    that:

    - a real compound the learner does not know surfaces whole (分钟, not 分 +
      钟), because the segmenter recognised 分钟 and it went into the lexicon;
    - a studied compound wins over its parts (北京大学 stays one known chunk
      instead of 北京 + 大学 being flagged).

    A resulting chunk counts as extra iff it is not itself in ``known_words``.
    """
    lexicon = known_words | {t for t in token_texts if is_chinese_word(t)}
    extras: set[str] = set()

    for run in _hanzi_runs(token_texts):
        pos = 0
        while pos < len(run):
            chunk = _longest_match(run, pos, lexicon)
            if chunk not in known_words:
                extras.add(chunk)
            pos += len(chunk)

    return sorted(extras)


def _hanzi_runs(token_texts: Sequence[str]) -> list[str]:
    runs: list[str] = []
    current = ""
    for token in token_texts:
        if is_chinese_word(token):
            current += token
        elif current:
            runs.append(current)
            current = ""
    if current:
        runs.append(current)
    return runs


def _longest_match(run: str, pos: int, lexicon: frozenset[str] | set[str]) -> str:
    for length in range(min(_MAX_WORD_LEN, len(run) - pos), 1, -1):
        candidate = run[pos : pos + length]
        if candidate in lexicon:
            return candidate
    return run[pos]  # single character — matched or not, it advances the scan
