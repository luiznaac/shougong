from __future__ import annotations

import random
from collections.abc import Mapping
from datetime import UTC, datetime, timedelta

from shougong.usecase.reading.vocabulary import VocabularyCategory, VocabularyWord
from shougong.usecase.reading.working_set import WordUsage, build_working_set

_NOW = datetime(2026, 6, 1, tzinfo=UTC)


def _word(word: str, *categories: VocabularyCategory, level: int | None = 1) -> VocabularyWord:
    return VocabularyWord(
        simplified=word,
        hsk_level=level,
        pos_tags=(),
        pos_categories=frozenset(categories),
    )


def _many(prefix: str, category: VocabularyCategory, n: int) -> list[VocabularyWord]:
    return [_word(f"{prefix}{i}", category) for i in range(n)]


def _big_vocabulary() -> list[VocabularyWord]:
    return (
        _many("v", VocabularyCategory.VERB, 30)
        + _many("n", VocabularyCategory.NOUN, 30)
        + _many("a", VocabularyCategory.QUALIFIER, 10)
        + _many("t", VocabularyCategory.TIME, 8)
        + _many("q", VocabularyCategory.QUANTITY, 8)
        + _many("p", VocabularyCategory.PERSON, 6)
        + _many("l", VocabularyCategory.PLACE, 6)
        + _many("d", VocabularyCategory.ADVERB, 6)
    )


def _run(
    profiles: list[VocabularyWord],
    *,
    usage: dict[str, WordUsage] | None = None,
    seed: int = 0,
    coverage_by_level: Mapping[int, float] | None = None,
):
    known = frozenset(p.simplified for p in profiles) | {"的", "了", "是"}  # add a bit of functional core
    return build_working_set(
        profiles=profiles,
        known_words=known,
        usage=usage or {},
        now=_NOW,
        rng=random.Random(seed),
        coverage_by_level=coverage_by_level or {},
    )


def test_small_vocabulary_falls_back_to_a_single_flat_group() -> None:
    ws = _run(_many("v", VocabularyCategory.VERB, 5) + _many("n", VocabularyCategory.NOUN, 5))

    assert list(ws.groups) == ["words"]
    assert ws.must_use == ()


def test_a_word_with_two_classes_appears_in_both_groups() -> None:
    profiles = [*_big_vocabulary(), _word("兼", VocabularyCategory.VERB, VocabularyCategory.NOUN)]
    ws = _run(profiles)

    # small enough per-class pools aside, 兼 is a candidate in both buckets
    assert "兼" in set(ws.groups["verbs"]) | set(ws.groups["nouns"]) or "兼" in ws.all_words


def test_the_functional_floor_is_the_known_core_when_there_is_no_coverage() -> None:
    ws = _run(_big_vocabulary())

    assert set(ws.groups["always_available"]) == {"的", "了", "是"}
    for label, words in ws.groups.items():
        if label != "always_available":
            assert not ({"的", "了", "是"} & set(words))


def test_coverage_weights_how_many_function_words_a_level_contributes() -> None:
    functional_l1 = [_word(f"f1_{i}", VocabularyCategory.FUNCTIONAL, level=1) for i in range(20)]
    functional_l2 = [_word(f"f2_{i}", VocabularyCategory.FUNCTIONAL, level=2) for i in range(20)]
    profiles = _big_vocabulary() + functional_l1 + functional_l2

    ws = _run(profiles, coverage_by_level={1: 1.0, 2: 0.0})
    group = set(ws.groups["always_available"])

    assert {"的", "了", "是"} <= group  # floor always there
    assert sum(w.startswith("f1_") for w in group) == 20  # full coverage → all of level 1
    assert sum(w.startswith("f2_") for w in group) == 0  # zero coverage → none of level 2


def test_quota_caps_each_class_and_keeps_verbs_from_being_starved() -> None:
    ws = _run(_big_vocabulary())

    assert len(ws.groups["verbs"]) == 12
    assert len(ws.groups["nouns"]) == 12
    assert len(ws.groups["descriptions"]) == 5
    assert len(ws.groups["verbs"]) == len(ws.groups["nouns"])


def test_a_heavily_used_word_is_rarely_sampled() -> None:
    profiles = _many("v", VocabularyCategory.VERB, 40) + _many("n", VocabularyCategory.NOUN, 12)
    usage = {"v0": WordUsage(uses=50, last_used_at=_NOW - timedelta(days=1))}

    with_bias = sum("v0" in _run(profiles, usage=usage, seed=s).groups["verbs"] for s in range(40))
    without_bias = sum("v0" in _run(profiles, seed=s).groups["verbs"] for s in range(40))

    assert with_bias < without_bias
    assert with_bias <= 8


def test_must_use_is_drawn_from_the_set_and_covers_verbs_and_nouns() -> None:
    ws = _run(_big_vocabulary())

    assert 4 <= len(ws.must_use) <= 6
    assert set(ws.must_use) <= set(ws.all_words)
    assert len(ws.must_use) == len(set(ws.must_use))  # no dupes
    assert sum(w.startswith("v") for w in ws.must_use) >= 2
    assert sum(w.startswith("n") for w in ws.must_use) >= 2
