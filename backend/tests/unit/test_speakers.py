from __future__ import annotations

import random
from collections import Counter
from datetime import UTC, datetime

from shougong.usecase.reading.speakers import resolve_speakers, usage_keys_for
from shougong.usecase.reading.working_set import WordUsage

_NOW = datetime(2026, 6, 1, tzinfo=UTC)

_ROLE_VOCAB = frozenset({"哥哥", "妹妹", "老师", "学生", "朋友"})


def _resolve(known: frozenset[str], *, usage: dict[str, WordUsage] | None = None, seed: int = 0):
    return resolve_speakers(known_words=known, usage=usage or {}, now=_NOW, rng=random.Random(seed), count=2)


def test_roles_are_preferred_when_the_learner_knows_at_least_two() -> None:
    speakers = _resolve(_ROLE_VOCAB)

    assert len(speakers) == 2
    assert all(s.name in _ROLE_VOCAB for s in speakers)
    assert all(s.pinyin is None for s in speakers)  # roles are known vocabulary
    assert speakers[0].name != speakers[1].name


def test_falls_back_to_whitelist_names_when_too_few_roles() -> None:
    speakers = _resolve(frozenset({"老师"}))  # only one role

    assert len(speakers) == 2
    assert all(len(s.name) == 2 for s in speakers)  # surname + given
    assert all(s.pinyin and " " in s.pinyin for s in speakers)  # "Wáng Lì"
    assert speakers[0].name[0] != speakers[1].name[0]  # different surnames


def test_names_do_not_repeat_much_over_many_generations() -> None:
    usage: dict[str, WordUsage] = {}
    counts: Counter[str] = Counter()
    now = _NOW
    for i in range(20):
        speakers = resolve_speakers(known_words=frozenset(), usage=usage, now=now, rng=random.Random(i), count=2)
        for name in (s.name for s in speakers):
            counts[name] += 1
        for key in usage_keys_for(speakers):
            prev = usage.get(key)
            usage[key] = WordUsage(uses=(prev.uses if prev else 0) + 1, last_used_at=now)

    assert counts.most_common(1)[0][1] <= 3  # spec section G: no name more than 3 times in 20
