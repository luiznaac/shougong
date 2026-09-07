from __future__ import annotations

from shougong.usecase.reading.proficiency import (
    BudgetAudience,
    HskLevelStats,
    budget_audience,
    estimate_proficiency,
)


def test_estimate_proficiency_masters_levels_contiguously_from_one() -> None:
    prof = estimate_proficiency(
        known_by_level={1: 9, 2: 7, 3: 4, 4: 1},
        total_by_level={1: 10, 2: 10, 3: 10, 4: 10},
    )

    assert prof.coverage_by_level == {1: 0.9, 2: 0.7, 3: 0.4, 4: 0.1}
    assert prof.estimated_level == 2  # 3 is below the 0.5 mastery bar, so it and 4 don't count


def test_a_weak_first_level_means_a_pure_beginner() -> None:
    prof = estimate_proficiency(known_by_level={1: 2}, total_by_level={1: 10, 2: 10})

    assert prof.estimated_level == 0


def test_budget_audience_checks_at_least_hsk1_even_at_level_zero() -> None:
    stats = HskLevelStats(total_by_level={1: 10}, functional_by_level={1: frozenset({"的", "了"})})

    # a low-coverage learner (estimated level 0) who nonetheless has the HSK 1 particles
    assert budget_audience(frozenset({"的", "了"}), stats, estimated_level=0) is BudgetAudience.INTERMEDIATE
    # ...and one who doesn't
    assert budget_audience(frozenset(), stats, estimated_level=0) is BudgetAudience.BEGINNER


def test_budget_audience_defaults_to_intermediate_without_hsk_data() -> None:
    empty = HskLevelStats(total_by_level={}, functional_by_level={})

    assert budget_audience(frozenset({"的"}), empty, estimated_level=0) is BudgetAudience.INTERMEDIATE


def test_budget_audience_turns_on_the_particle_floor() -> None:
    stats = HskLevelStats(
        total_by_level={1: 10, 2: 10},
        functional_by_level={1: frozenset({"的", "了", "是"}), 2: frozenset({"在", "不"})},
    )
    expected_at_level_2 = frozenset({"的", "了", "是", "在", "不"})  # 5 words

    # 4/5 = 0.8 >= floor
    assert budget_audience(frozenset(expected_at_level_2 - {"不"}), stats, 2) is BudgetAudience.INTERMEDIATE
    # 3/5 = 0.6 < floor
    assert budget_audience(frozenset({"的", "了", "是"}), stats, 2) is BudgetAudience.BEGINNER
