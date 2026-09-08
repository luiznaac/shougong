"""Dialogue speaker resolution — pure, stdlib only.

A dialogue needs named speakers. Two sources, in order of preference:

1. Role words (哥哥, 老师, …) the learner already knows — zero cost, and they
   reinforce useful vocabulary. Used when the learner knows at least `count`.
2. Otherwise a fixed whitelist of surnames and given names combined at runtime
   (王丽, 李明), treated like grammatical scaffolding: outside `known_words`,
   outside the extra-word budget, shown with pinyin on first use.

Both draw with the least-recently-used bias the working set uses. Speaker usage
is tracked in `reading_word_usage` under the ``speaker:`` prefix so it never
collides with content vocabulary.
"""

from __future__ import annotations

import random
from collections.abc import Mapping, Sequence
from datetime import datetime

from shougong.usecase.reading.model import ReadingSpeaker
from shougong.usecase.reading.working_set import WordUsage, recency_weight

USAGE_PREFIX = "speaker:"

_ROLES: frozenset[str] = frozenset(
    ("哥哥", "姐姐", "弟弟", "妹妹", "妈妈", "爸爸", "爷爷", "老师", "同学", "朋友", "学生", "医生")
)

# Contrasting pairs (all members are roles) tried first — two of the same
# generation/role invite referent ambiguity.
_ROLE_PAIRS: tuple[tuple[str, str], ...] = (
    ("哥哥", "妹妹"),
    ("姐姐", "弟弟"),
    ("哥哥", "姐姐"),
    ("弟弟", "妹妹"),
    ("爸爸", "妈妈"),
    ("爷爷", "爸爸"),
    ("老师", "学生"),
    ("老师", "同学"),
    ("医生", "学生"),
    ("朋友", "同学"),
)

_SURNAMES: dict[str, str] = {
    "王": "Wáng",
    "李": "Lǐ",
    "张": "Zhāng",
    "刘": "Liú",
    "陈": "Chén",
    "林": "Lín",
    "黄": "Huáng",
    "吴": "Wú",
    "周": "Zhōu",
    "高": "Gāo",
}
_GIVEN: dict[str, str] = {
    "丽": "Lì",
    "芳": "Fāng",
    "静": "Jìng",
    "敏": "Mǐn",
    "燕": "Yàn",
    "娟": "Juān",
    "婷": "Tíng",
    "雪": "Xuě",
    "兰": "Lán",
    "玉": "Yù",
    "明": "Míng",
    "伟": "Wěi",
    "强": "Qiáng",
    "军": "Jūn",
    "磊": "Lěi",
    "涛": "Tāo",
    "勇": "Yǒng",
    "杰": "Jié",
    "峰": "Fēng",
    "刚": "Gāng",
}


def usage_keys() -> list[str]:
    """Every `reading_word_usage` key the resolver may weigh — load these first."""
    return [f"{USAGE_PREFIX}{token}" for token in (*_ROLES, *_SURNAMES, *_GIVEN)]


def usage_keys_for(speakers: Sequence[ReadingSpeaker]) -> list[str]:
    """The keys to bump after a dialogue is generated — role names whole, built
    names by their characters."""
    keys: list[str] = []
    for speaker in speakers:
        if speaker.name in _ROLES:
            keys.append(f"{USAGE_PREFIX}{speaker.name}")
        else:
            keys.extend(f"{USAGE_PREFIX}{char}" for char in speaker.name)
    return keys


def resolve_speakers(
    *,
    known_words: frozenset[str],
    usage: Mapping[str, WordUsage],
    now: datetime,
    rng: random.Random,
    count: int = 2,
) -> tuple[ReadingSpeaker, ...]:
    roles = sorted(_ROLES & known_words)
    if len(roles) >= count:
        return _pick_roles(roles, usage, now, rng, count)
    return _pick_names(usage, now, rng, count)


def _weight(token: str, usage: Mapping[str, WordUsage], now: datetime) -> float:
    return recency_weight(f"{USAGE_PREFIX}{token}", usage, now)


def _weighted_pick(
    pool: list[str], usage: Mapping[str, WordUsage], now: datetime, rng: random.Random, k: int
) -> list[str]:
    pool = list(pool)
    chosen: list[str] = []
    while pool and len(chosen) < k:
        weights = [_weight(token, usage, now) for token in pool]
        total = sum(weights)
        if total <= 0:
            index = rng.randrange(len(pool))
        else:
            threshold, cumulative, index = rng.random() * total, 0.0, len(pool) - 1
            for i, weight in enumerate(weights):
                cumulative += weight
                if threshold <= cumulative:
                    index = i
                    break
        chosen.append(pool.pop(index))
    return chosen


def _pick_roles(
    roles: list[str], usage: Mapping[str, WordUsage], now: datetime, rng: random.Random, count: int
) -> tuple[ReadingSpeaker, ...]:
    if count == 2:
        known = set(roles)
        viable = [pair for pair in _ROLE_PAIRS if known.issuperset(pair)]
        if viable:
            pair = rng.choice(viable)
            return tuple(ReadingSpeaker(name=name, pinyin=None) for name in pair)
    picked = _weighted_pick(roles, usage, now, rng, count)
    return tuple(ReadingSpeaker(name=name, pinyin=None) for name in picked)


def _pick_names(
    usage: Mapping[str, WordUsage], now: datetime, rng: random.Random, count: int
) -> tuple[ReadingSpeaker, ...]:
    surnames = _weighted_pick(list(_SURNAMES), usage, now, rng, count)
    given = _weighted_pick(list(_GIVEN), usage, now, rng, count)
    return tuple(
        ReadingSpeaker(
            name=f"{surname}{name}",
            pinyin=f"{_SURNAMES[surname]} {_GIVEN[name]}",
        )
        for surname, name in zip(surnames, given, strict=True)
    )
