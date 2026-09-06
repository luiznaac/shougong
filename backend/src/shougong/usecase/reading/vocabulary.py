"""Vocabulary categorisation for reading generation — pure, stdlib only.

A learner's known words are tagged with a broad grammatical `VocabularyCategory`
so a later step can build a balanced working set (sampling verbs, nouns,
qualifiers… by quota rather than sending one flat list). The category is derived
mechanically from the HSK dataset's part-of-speech tags (ICTCLAS family, the
same jieba uses) plus a fixed list of function words that must never be sampled.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from enum import StrEnum


class VocabularyCategory(StrEnum):
    VERB = "verb"
    NOUN = "noun"
    PERSON = "person"
    PLACE = "place"
    QUALIFIER = "qualifier"  # adjectives and stative descriptors
    ADVERB = "adverb"
    TIME = "time"
    QUANTITY = "quantity"  # numbers and classifiers
    CONNECTIVE = "connective"
    PRONOUN = "pronoun"
    FUNCTIONAL = "functional"  # particles and the fixed core — never sampled, always present
    OTHER = "other"


# The fixed function-word core (spec §3.3.1): the intersection of this list with
# the learner's known words is always sent whole and never counts against a
# sampling quota. Dropping any of these truncates the grammar the learner has.
_FUNCTIONAL_CORE = (
    "的 了 是 在 有 不 没 很 十分 也 都 和 但是 不过 再 就 会 能 可以 要 想 吗 "
    "什么 为什么 怎么样 这 那 哪 里 个 们 过 只要"
)
FUNCTIONAL_CORE: frozenset[str] = frozenset(_FUNCTIONAL_CORE.split())


def category_for(simplified: str, pos_tags: Sequence[str]) -> VocabularyCategory:
    """The broad category a word falls in, from its HSK POS tags.

    The dataset lists every POS a word can take, so words come with several
    tags. Rules are ordered from the most reliable / most useful distinction
    down to generic noun/verb — first match wins. Numerals and classifiers go
    first because they're unambiguous (一 is tagged m/d/t but is plainly a
    number)."""
    if simplified in FUNCTIONAL_CORE:
        return VocabularyCategory.FUNCTIONAL

    tags = set(pos_tags)

    def has(*wanted: str) -> bool:
        return any(t in tags for t in wanted)

    def has_prefix(prefix: str) -> bool:
        return any(t.startswith(prefix) for t in tags)

    if has_prefix("m") or has_prefix("q"):  # numerals (m, mq, mg) and classifiers (q)
        return VocabularyCategory.QUANTITY
    if has("c"):
        return VocabularyCategory.CONNECTIVE
    if has_prefix("a") or has("b", "z"):
        return VocabularyCategory.QUALIFIER
    if has_prefix("r"):
        return VocabularyCategory.PRONOUN
    if has_prefix("t"):
        return VocabularyCategory.TIME
    if has("ns", "nt", "f", "s"):
        return VocabularyCategory.PLACE
    if has("nr"):
        return VocabularyCategory.PERSON
    if has_prefix("d"):
        return VocabularyCategory.ADVERB
    if has("u", "y", "e"):
        return VocabularyCategory.FUNCTIONAL
    if has_prefix("v"):
        return VocabularyCategory.VERB
    if has_prefix("n"):
        return VocabularyCategory.NOUN
    return VocabularyCategory.OTHER


class ProfileSource(StrEnum):
    HSK = "hsk"  # resolved from the HSK dataset
    MANUAL = "manual"  # overridden by the user — sync must not touch it
    UNKNOWN = "unknown"  # not found in the HSK dataset


@dataclass(frozen=True, slots=True)
class HskEntry:
    hsk_level: int | None
    pos_tags: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class VocabularyProfile:
    simplified: str
    hsk_level: int | None
    pos_tags: tuple[str, ...]
    pos_category: VocabularyCategory
    source: ProfileSource
    # Display only — filled from the dictionary when listing, never stored.
    pinyin: str | None = None
    gloss: str | None = None


# Below this many known QUALIFIER words, texts come out descriptively poor for
# lack of adjectives, not for lack of a good model (spec §3.3.1 rule 4).
QUALIFIER_FLOOR = 5


@dataclass(frozen=True, slots=True)
class VocabularySummary:
    total: int
    categorised: int  # not UNKNOWN
    by_category: dict[str, int]
    by_hsk_level: dict[str, int]  # keyed by str(level) or "none"
    qualifier_shortage: bool
