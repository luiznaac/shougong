"""Vocabulary categorisation for reading generation — pure, stdlib only.

A learner's known words are tagged with broad grammatical `VocabularyCategory`
values so a later step can build a balanced working set (sampling verbs, nouns,
qualifiers… by quota rather than sending one flat list). Categories are derived
mechanically from the HSK dataset's part-of-speech tags (ICTCLAS family, the
same jieba uses) plus a fixed list of function words that must never be sampled.

A word carries *every* category its tags imply — a noun-verb (`vn`) is both a
verb and a noun and is offered in both groups.
"""

from __future__ import annotations

from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from enum import StrEnum

from shougong.usecase.dictionary.model import HskDatasetWord
from shougong.usecase.reading.proficiency import HskLevelStats, Proficiency


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
    FUNCTIONAL = "functional"  # particles and the fixed core — never sampled as content
    OTHER = "other"


# The fixed function-word core (spec §3.3.1): the intersection of this list with
# the learner's known words is always sent whole (the floor of the
# `always_available` group). Dropping any of these truncates the grammar the
# learner has.
_FUNCTIONAL_CORE = (
    "的 了 是 在 有 不 没 很 十分 也 都 和 但是 不过 再 就 会 能 可以 要 想 吗 "
    "什么 为什么 怎么样 这 那 哪 里 个 们 过 只要"
)
FUNCTIONAL_CORE: frozenset[str] = frozenset(_FUNCTIONAL_CORE.split())


def categories_for(simplified: str, pos_tags: Sequence[str]) -> frozenset[VocabularyCategory]:
    """Every category a word falls in, from its HSK POS tags.

    The dataset lists every POS a word can take, so words come with several
    tags; each tag contributes its category and the results are unioned. Function
    words are the one exception — a word in `FUNCTIONAL_CORE`, or tagged as a
    particle/modal/interjection, is *only* `FUNCTIONAL` so it never leaks into a
    content group.
    """
    if simplified in FUNCTIONAL_CORE:
        return frozenset({VocabularyCategory.FUNCTIONAL})

    tags = set(pos_tags)
    if tags & {"u", "y", "e"}:
        return frozenset({VocabularyCategory.FUNCTIONAL})

    found: set[VocabularyCategory] = set()
    for tag in tags:
        if tag.startswith("m") or tag.startswith("q"):
            found.add(VocabularyCategory.QUANTITY)
        elif tag == "c":
            found.add(VocabularyCategory.CONNECTIVE)
        elif tag.startswith("a") or tag in {"b", "z"}:
            found.add(VocabularyCategory.QUALIFIER)
        elif tag.startswith("r"):
            found.add(VocabularyCategory.PRONOUN)
        elif tag.startswith("d"):
            found.add(VocabularyCategory.ADVERB)
        elif tag == "nr":
            found.add(VocabularyCategory.PERSON)
        elif tag in {"ns", "nt"}:
            found.add(VocabularyCategory.PLACE)
        elif tag.startswith("t"):
            found.add(VocabularyCategory.TIME)
        elif tag.startswith("v"):
            found.add(VocabularyCategory.VERB)
        elif tag.startswith("n") or tag in {"f", "s"}:
            found.add(VocabularyCategory.NOUN)

    return frozenset(found) or frozenset({VocabularyCategory.OTHER})


@dataclass(frozen=True, slots=True)
class VocabularyWord:
    simplified: str
    hsk_level: int | None
    pos_tags: tuple[str, ...]
    pos_categories: frozenset[VocabularyCategory]
    # Display only — filled from the dictionary when listing, never stored.
    pinyin: str | None = None
    gloss: str | None = None


def hsk_level_stats(words: Iterable[HskDatasetWord]) -> HskLevelStats:
    """Per-HSK-level totals and the function words at each level, from the words
    the dictionary carries an HSK level for."""
    total_by_level: dict[int, int] = {}
    functional: dict[int, set[str]] = {}
    for word in words:
        if word.hsk_level is None:
            continue
        total_by_level[word.hsk_level] = total_by_level.get(word.hsk_level, 0) + 1
        if VocabularyCategory.FUNCTIONAL in categories_for(word.simplified, word.pos_tags):
            functional.setdefault(word.hsk_level, set()).add(word.simplified)
    return HskLevelStats(
        total_by_level=total_by_level,
        functional_by_level={level: frozenset(words) for level, words in functional.items()},
    )


# Below this many known QUALIFIER words, texts come out descriptively poor for
# lack of adjectives, not for lack of a good model (spec §3.3.1 rule 4).
QUALIFIER_FLOOR = 5


@dataclass(frozen=True, slots=True)
class VocabularySummary:
    total: int
    categorised: int  # found in the HSK list (has an hsk_level)
    by_category: dict[str, int]  # membership count — a word in N categories counts N times
    by_hsk_level: dict[str, int]  # keyed by str(level) or "none"
    qualifier_shortage: bool
    proficiency: Proficiency
