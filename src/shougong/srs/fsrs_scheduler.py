"""`FsrsScheduler` — implements `ISrsScheduler` on top of `open-spaced-repetition/py-fsrs`.

This is the ONLY module allowed to import `fsrs`. It converts between the
first-party `shougong.usecase.srs` types and `fsrs`'s own at the boundary.
"""

from __future__ import annotations

from datetime import datetime

from fsrs import Card, Rating, Scheduler, State

from shougong.usecase.srs.model import SrsCard, SrsRating, SrsReviewLog, SrsState


def _to_fsrs(card: SrsCard) -> Card:
    return Card(
        state=State(card.state.value),
        step=card.step,
        stability=card.stability,
        difficulty=card.difficulty,
        due=card.due,
        last_review=card.last_review,
    )


def _from_fsrs(card: Card) -> SrsCard:
    return SrsCard(
        state=SrsState(card.state.value),
        step=card.step,
        stability=card.stability,
        difficulty=card.difficulty,
        due=card.due,
        last_review=card.last_review,
    )


class FsrsScheduler:
    def __init__(self, scheduler: Scheduler | None = None) -> None:
        self._scheduler = scheduler or Scheduler()

    def new_card(self, now: datetime) -> SrsCard:
        return _from_fsrs(Card(due=now))

    def review(self, card: SrsCard, rating: SrsRating, now: datetime) -> tuple[SrsCard, SrsReviewLog]:
        updated, log = self._scheduler.review_card(_to_fsrs(card), Rating(rating.value), review_datetime=now)
        return _from_fsrs(updated), SrsReviewLog(
            rating=SrsRating(int(log.rating)),
            review_datetime=log.review_datetime,
        )
