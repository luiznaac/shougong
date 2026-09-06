"""Working-set sampling for reading generation — pure, stdlib only.

Composition and validation are separated (spec §3.3): the model is handed a
small *working set* of ~50 content words, sampled and grouped by grammatical
class from the learner's profiled vocabulary and rotated every call, while the
validator still checks the finished text against the whole known-word list.

Sampling is biased toward words the learner hasn't seen recently, so re-reading
practice falls out for free (spec §3.3.1).
"""

from __future__ import annotations

import random
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from datetime import datetime

from shougong.usecase.reading.vocabulary import FUNCTIONAL_CORE, VocabularyCategory, VocabularyProfile

# Target content-word count and the per-class quotas it is split into. Sums to a
# little over the target on purpose — the spec says tune the proportions, not the
# absolute numbers. Order here is the order groups appear in the prompt.
_TARGET_SIZE = 50
_QUOTAS: tuple[tuple[VocabularyCategory, int], ...] = (
    (VocabularyCategory.VERB, 12),
    (VocabularyCategory.NOUN, 12),
    (VocabularyCategory.PERSON, 5),
    (VocabularyCategory.PLACE, 4),
    (VocabularyCategory.QUALIFIER, 5),
    (VocabularyCategory.TIME, 4),
    (VocabularyCategory.QUANTITY, 4),
    (VocabularyCategory.CONNECTIVE, 4),
    (VocabularyCategory.ADVERB, 4),
    (VocabularyCategory.OTHER, 3),
)
_GROUP_LABELS: dict[VocabularyCategory, str] = {
    VocabularyCategory.VERB: "verbs",
    VocabularyCategory.NOUN: "nouns",
    VocabularyCategory.PERSON: "people",
    VocabularyCategory.PLACE: "places",
    VocabularyCategory.QUALIFIER: "descriptions",
    VocabularyCategory.TIME: "time",
    VocabularyCategory.QUANTITY: "quantity",
    VocabularyCategory.CONNECTIVE: "connectives",
    VocabularyCategory.ADVERB: "adverbs",
    VocabularyCategory.OTHER: "other",
}

_MIN_CONTENT_FOR_SAMPLING = 30  # below this, send everything as one flat group
_MUST_USE_COUNT = 6
_UNIFORM_FRACTION = 0.2  # share of each quota drawn without recency bias
_RECENCY_DAYS_CAP = 60


@dataclass(frozen=True, slots=True)
class WordUsage:
    uses: int
    last_used_at: datetime | None


@dataclass(frozen=True, slots=True)
class WorkingSet:
    # group label -> words; "always_available" holds the function-word core
    groups: dict[str, tuple[str, ...]]
    must_use: tuple[str, ...]

    @property
    def all_words(self) -> tuple[str, ...]:
        return tuple(word for words in self.groups.values() for word in words)


def build_working_set(
    *,
    profiles: Sequence[VocabularyProfile],
    known_words: frozenset[str],
    usage: Mapping[str, WordUsage],
    now: datetime,
    rng: random.Random,
) -> WorkingSet:
    functional = sorted(FUNCTIONAL_CORE & known_words)
    content = [
        p for p in profiles if p.simplified in known_words and p.pos_category is not VocabularyCategory.FUNCTIONAL
    ]

    if len(content) < _MIN_CONTENT_FOR_SAMPLING:
        # Not enough categorised vocabulary to sample from — fall back to the
        # flat list, same as before working sets existed.
        return WorkingSet(groups={"words": tuple(sorted(known_words))}, must_use=())

    by_category: dict[VocabularyCategory, list[str]] = {}
    for profile in content:
        by_category.setdefault(profile.pos_category, []).append(profile.simplified)

    sample_all = len(content) <= _TARGET_SIZE  # small enough to send whole, still grouped

    groups: dict[str, tuple[str, ...]] = {}
    if functional:
        groups["always_available"] = tuple(functional)

    sampled_by_category: dict[VocabularyCategory, list[str]] = {}
    for category, quota in _QUOTAS:
        pool = by_category.get(category)
        if not pool:
            continue
        picked = list(pool) if sample_all else _sample_category(pool, quota, usage, now, rng)
        sampled_by_category[category] = picked
        groups[_GROUP_LABELS[category]] = tuple(picked)

    return WorkingSet(groups=groups, must_use=_pick_must_use(sampled_by_category, rng))


def _sample_category(
    pool: list[str], quota: int, usage: Mapping[str, WordUsage], now: datetime, rng: random.Random
) -> list[str]:
    quota = min(quota, len(pool))
    uniform_k = round(quota * _UNIFORM_FRACTION)
    weighted_k = quota - uniform_k

    remaining = list(pool)
    weights = [_recency_weight(word, usage, now) for word in remaining]
    picked = _weighted_sample_without_replacement(remaining, weights, weighted_k, rng)

    leftover = [word for word in remaining if word not in picked]
    picked.extend(rng.sample(leftover, min(uniform_k, len(leftover))))
    return picked


def _recency_weight(word: str, usage: Mapping[str, WordUsage], now: datetime) -> float:
    record = usage.get(word)
    uses = record.uses if record else 0
    if record is None or record.last_used_at is None:
        days = _RECENCY_DAYS_CAP
    else:
        days = max(0, min((now - record.last_used_at).days, _RECENCY_DAYS_CAP))
    return 1.0 / (1 + uses) * (1 + days / 30)


def _weighted_sample_without_replacement(
    items: list[str], weights: list[float], k: int, rng: random.Random
) -> list[str]:
    items = list(items)
    weights = list(weights)
    chosen: list[str] = []
    for _ in range(min(k, len(items))):
        index = _weighted_index(weights, rng)
        chosen.append(items.pop(index))
        weights.pop(index)
    return chosen


def _weighted_index(weights: list[float], rng: random.Random) -> int:
    total = sum(weights)
    if total <= 0:
        return rng.randrange(len(weights))
    threshold = rng.random() * total
    cumulative = 0.0
    for index, weight in enumerate(weights):
        cumulative += weight
        if threshold <= cumulative:
            return index
    return len(weights) - 1


def _pick_must_use(sampled_by_category: dict[VocabularyCategory, list[str]], rng: random.Random) -> tuple[str, ...]:
    verbs = sampled_by_category.get(VocabularyCategory.VERB, [])
    nouns = sampled_by_category.get(VocabularyCategory.NOUN, [])
    must: list[str] = []
    must.extend(rng.sample(verbs, min(2, len(verbs))))
    must.extend(rng.sample(nouns, min(2, len(nouns))))

    rest = [word for words in sampled_by_category.values() for word in words if word not in must]
    must.extend(rng.sample(rest, min(_MUST_USE_COUNT - len(must), len(rest))))
    return tuple(must)
