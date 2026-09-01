from __future__ import annotations

from datetime import UTC, datetime, timedelta

from fsrs import Scheduler

from shougong.srs.fsrs_scheduler import FsrsScheduler
from shougong.usecase.srs.model import SrsRating, SrsState

_NOW = datetime(2026, 1, 1, 12, 0, tzinfo=UTC)


def _scheduler() -> FsrsScheduler:
    return FsrsScheduler(Scheduler(enable_fuzzing=False))


def test_new_card_is_due_now_and_learning() -> None:
    card = _scheduler().new_card(_NOW)

    assert card.state is SrsState.LEARNING
    assert card.due == _NOW
    assert card.last_review is None


def test_review_good_moves_due_forward_and_records_the_rating() -> None:
    scheduler = _scheduler()
    card = scheduler.new_card(_NOW)

    updated, log = scheduler.review(card, SrsRating.GOOD, _NOW)

    assert updated.due > _NOW
    assert updated.last_review == _NOW
    assert log.rating is SrsRating.GOOD
    assert log.review_datetime == _NOW


def test_review_again_keeps_the_card_due_soon() -> None:
    scheduler = _scheduler()
    card = scheduler.new_card(_NOW)

    updated, _ = scheduler.review(card, SrsRating.AGAIN, _NOW)

    assert updated.due - _NOW <= timedelta(minutes=10)
