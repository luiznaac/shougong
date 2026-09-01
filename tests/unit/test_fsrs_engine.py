from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fsrs import Scheduler

from shougong.srs.fsrs_engine import FsrsEngine
from shougong.usecase.srs.model import SrsRating, SrsState

_NOW = datetime(2026, 1, 1, 12, 0, tzinfo=UTC)


def _engine() -> FsrsEngine:
    # Same config as the default (no learning/relearning steps), fuzzing off for determinism.
    return FsrsEngine(Scheduler(learning_steps=(), relearning_steps=(), enable_fuzzing=False))


def test_new_card_is_due_now_and_learning() -> None:
    card = _engine().new_card(_NOW)

    assert card.state is SrsState.LEARNING
    assert card.due == _NOW
    assert card.last_review is None


def test_first_review_skips_learning_and_schedules_days_out() -> None:
    engine = _engine()
    card = engine.new_card(_NOW)

    updated, log = engine.review(card, SrsRating.GOOD, _NOW)

    assert updated.state is SrsState.REVIEW
    assert updated.due - _NOW >= timedelta(days=1)
    assert updated.last_review == _NOW
    assert log.rating is SrsRating.GOOD
    assert log.review_datetime == _NOW


def test_harder_ratings_are_scheduled_sooner_than_easier_ones() -> None:
    engine = _engine()
    card = engine.new_card(_NOW)

    again_due = engine.review(card, SrsRating.AGAIN, _NOW)[0].due
    good_due = engine.review(card, SrsRating.GOOD, _NOW)[0].due
    easy_due = engine.review(card, SrsRating.EASY, _NOW)[0].due

    assert again_due < good_due < easy_due
