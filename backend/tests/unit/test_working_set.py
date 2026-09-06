from __future__ import annotations

import random
from datetime import UTC, datetime, timedelta

from shougong.usecase.reading.vocabulary import (
    ProfileSource,
    VocabularyCategory,
    VocabularyProfile,
)
from shougong.usecase.reading.working_set import WordUsage, build_working_set

_NOW = datetime(2026, 6, 1, tzinfo=UTC)


def _profile(word: str, category: VocabularyCategory) -> VocabularyProfile:
    return VocabularyProfile(
        simplified=word,
        hsk_level=1,
        pos_tags=(),
        pos_category=category,
        source=ProfileSource.HSK,
    )


def _many(prefix: str, category: VocabularyCategory, n: int) -> list[VocabularyProfile]:
    return [_profile(f"{prefix}{i}", category) for i in range(n)]


def _big_vocabulary() -> list[VocabularyProfile]:
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


def _run(profiles: list[VocabularyProfile], *, usage: dict[str, WordUsage] | None = None, seed: int = 0):
    known = frozenset(p.simplified for p in profiles) | {"的", "了", "是"}  # add a bit of functional core
    return build_working_set(
        profiles=profiles,
        known_words=known,
        usage=usage or {},
        now=_NOW,
        rng=random.Random(seed),
    )


def test_small_vocabulary_falls_back_to_a_single_flat_group() -> None:
    ws = _run(_many("v", VocabularyCategory.VERB, 5) + _many("n", VocabularyCategory.NOUN, 5))

    assert list(ws.groups) == ["words"]
    assert ws.must_use == ()


def test_the_functional_core_is_always_present_and_never_sampled() -> None:
    ws = _run(_big_vocabulary())

    assert set(ws.groups["always_available"]) == {"的", "了", "是"}
    # none of the sampled content groups contain a core word
    for label, words in ws.groups.items():
        if label != "always_available":
            assert not ({"的", "了", "是"} & set(words))


def test_quota_caps_each_class_and_keeps_verbs_from_being_starved() -> None:
    ws = _run(_big_vocabulary())

    assert len(ws.groups["verbs"]) == 12
    assert len(ws.groups["nouns"]) == 12
    assert len(ws.groups["descriptions"]) == 5
    # a big noun-heavy vocabulary still yields a full verb quota
    assert len(ws.groups["verbs"]) == len(ws.groups["nouns"])


def test_a_heavily_used_word_is_rarely_sampled() -> None:
    profiles = _many("v", VocabularyCategory.VERB, 40) + _many("n", VocabularyCategory.NOUN, 12)
    # v0 has been used a lot, recently; the other verbs never
    usage = {"v0": WordUsage(uses=50, last_used_at=_NOW - timedelta(days=1))}

    with_bias = sum("v0" in _run(profiles, usage=usage, seed=s).groups["verbs"] for s in range(40))
    without_bias = sum("v0" in _run(profiles, seed=s).groups["verbs"] for s in range(40))

    assert with_bias < without_bias
    assert with_bias <= 8  # quota 12 of 40; an unbiased pick lands it ~12/40 of the time


def test_must_use_is_drawn_from_the_set_and_covers_verbs_and_nouns() -> None:
    ws = _run(_big_vocabulary())

    assert 4 <= len(ws.must_use) <= 6
    assert set(ws.must_use) <= set(ws.all_words)
    assert sum(w.startswith("v") for w in ws.must_use) >= 2
    assert sum(w.startswith("n") for w in ws.must_use) >= 2
