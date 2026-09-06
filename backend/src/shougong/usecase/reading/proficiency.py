"""Proficiency estimate from HSK coverage — pure, stdlib only.

The learner's grasp of each HSK level (words known / words in that level) gives a
rough overall level, which in turn drives how the generator is told to spend the
extra-word budget (spec §3.5): a learner who already has the function words of
their level should spend it on a concrete content word; one who doesn't should
spend it on the particles the text can't work without.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum

# Coverage a level needs before it counts as "mastered" for level estimation.
_MASTERY = 0.5
# Fraction of the expected function words the learner must know to be treated as
# past the beginner stage.
_PARTICLE_FLOOR = 0.7


@dataclass(frozen=True, slots=True)
class HskLevelStats:
    total_by_level: dict[int, int]  # dataset entries per HSK level
    functional_by_level: dict[int, frozenset[str]]  # dataset words per level that are function words


@dataclass(frozen=True, slots=True)
class Proficiency:
    coverage_by_level: dict[int, float]  # known / total per HSK level, 0..1
    estimated_level: int  # highest level mastered contiguously from 1 (0 = pure beginner)


class BudgetAudience(StrEnum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"


def estimate_proficiency(known_by_level: Mapping[int, int], total_by_level: Mapping[int, int]) -> Proficiency:
    coverage = {
        level: (known_by_level.get(level, 0) / total if total else 0.0) for level, total in total_by_level.items()
    }
    estimated = 0
    level = 1
    while coverage.get(level, 0.0) >= _MASTERY:
        estimated = level
        level += 1
    return Proficiency(coverage_by_level=coverage, estimated_level=estimated)


def budget_audience(known_words: frozenset[str], stats: HskLevelStats, estimated_level: int) -> BudgetAudience:
    # The learner is expected to have the function words up to their level — but
    # at least the HSK 1 ones, which every learner picks up first (spec §3.5).
    top_level = max(estimated_level, 1)
    expected: frozenset[str] = frozenset().union(
        *(stats.functional_by_level.get(level, frozenset()) for level in range(1, top_level + 1))
    )
    if not expected:
        return BudgetAudience.INTERMEDIATE  # no data to say otherwise — assume the safe (content) policy
    known_fraction = len(expected & known_words) / len(expected)
    return BudgetAudience.INTERMEDIATE if known_fraction >= _PARTICLE_FLOOR else BudgetAudience.BEGINNER
