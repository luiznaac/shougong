"""Leech policy: the recency window, the threshold and the worst-first ordering."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from shougong.usecase.insights.model import GradeWindow, ReviewGrade
from shougong.usecase.insights.policy import is_leech, order_leeches
from shougong.usecase.srs.model import SrsRating

_EPOCH = datetime(2026, 1, 1, tzinfo=UTC)


def _window(item_id: int, ratings: list[SrsRating]) -> GradeWindow:
    """A window built from ratings given oldest first; stored newest first, as the read returns it."""
    grades = tuple(
        ReviewGrade(rating=rating, review_datetime=_EPOCH + timedelta(minutes=index))
        for index, rating in enumerate(ratings)
    )
    return GradeWindow(study_item_id=item_id, grades=tuple(reversed(grades)))


def test_three_again_in_three_is_a_leech() -> None:
    window = _window(1, [SrsRating.AGAIN, SrsRating.AGAIN, SrsRating.AGAIN])

    assert is_leech(window)


def test_a_shorter_window_is_evaluated_as_is() -> None:
    assert not is_leech(_window(1, [SrsRating.AGAIN]))
    assert not is_leech(_window(1, [SrsRating.AGAIN, SrsRating.GOOD, SrsRating.AGAIN]))
    assert is_leech(_window(1, [SrsRating.AGAIN, SrsRating.GOOD, SrsRating.AGAIN, SrsRating.AGAIN]))


def test_two_failures_in_ten_is_not_a_leech() -> None:
    window = _window(1, [SrsRating.AGAIN, SrsRating.AGAIN, *[SrsRating.GOOD] * 8])

    assert not is_leech(window)


def test_non_again_grades_occupy_window_slots() -> None:
    window = _window(
        1,
        [SrsRating.AGAIN, SrsRating.AGAIN, SrsRating.HARD, *[SrsRating.GOOD] * 7],
    )

    assert not is_leech(window)


def test_a_good_streak_rolls_the_failures_out_and_clears_the_flag() -> None:
    assert is_leech(_window(1, [*[SrsRating.AGAIN] * 3, *[SrsRating.GOOD] * 7]))
    # after ten more good grades the same read window holds no failure at all
    assert not is_leech(_window(1, [SrsRating.GOOD] * 10))


def test_leech_order_is_worst_first_then_most_recent_failure_then_id() -> None:
    four_failures = _window(1, [SrsRating.AGAIN] * 4)
    three_older = _window(2, [SrsRating.AGAIN] * 3)
    three_recent = _window(3, [SrsRating.GOOD, *[SrsRating.AGAIN] * 3])
    same_as_three_recent = _window(5, [SrsRating.GOOD, *[SrsRating.AGAIN] * 3])
    not_a_leech = _window(4, [SrsRating.AGAIN, SrsRating.GOOD])

    ranked = order_leeches([three_older, not_a_leech, same_as_three_recent, four_failures, three_recent])

    assert [rank.study_item_id for rank in ranked] == [1, 3, 5, 2]
    assert [rank.failure_count for rank in ranked] == [4, 3, 3, 3]
