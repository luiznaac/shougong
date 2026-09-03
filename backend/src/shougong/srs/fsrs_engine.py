"""`FsrsEngine` — implements `ISrsEngine` on top of `open-spaced-repetition/py-fsrs`.

This is the ONLY module allowed to import `fsrs`. It converts between the
first-party `shougong.usecase.srs` types and `fsrs`'s own at the boundary.
"""

from __future__ import annotations

from datetime import datetime

from fsrs import Card, Rating, Scheduler, State

from shougong.usecase.srs.engine import ISrsEngine
from shougong.usecase.srs.model import SrsCard, SrsRating, SrsReviewLog, SrsState


def _to_fsrs(card: SrsCard) -> Card:
    # `step` is intentionally not tracked: with no learning/relearning steps a card is only
    # ever on step 0 (Learning) or None (Review), which `fsrs.Card` derives from `state` itself.
    return Card(
        state=State(card.state.value),
        stability=card.stability,
        difficulty=card.difficulty,
        due=card.due,
        last_review=card.last_review,
    )


def _from_fsrs(card: Card) -> SrsCard:
    return SrsCard(
        state=SrsState(card.state.value),
        stability=card.stability,
        difficulty=card.difficulty,
        due=card.due,
        last_review=card.last_review,
    )


def _default_scheduler() -> Scheduler:
    # No short-term learning phase: `learning_steps=()` means a card is scheduled
    # days out on its very first review, and `relearning_steps=()` means an
    # "Again" in Review keeps the card in Review instead of dropping to Relearning.
    return Scheduler(learning_steps=(), relearning_steps=())


class FsrsEngine(ISrsEngine):
    def __init__(self, scheduler: Scheduler | None = None) -> None:
        self._scheduler = scheduler or _default_scheduler()

    def new_card(self, now: datetime) -> SrsCard:
        return _from_fsrs(Card(due=now))

    def review(self, card: SrsCard, rating: SrsRating, now: datetime) -> tuple[SrsCard, SrsReviewLog]:
        updated, log = self._scheduler.review_card(_to_fsrs(card), Rating(rating.value), review_datetime=now)
        return _from_fsrs(updated), SrsReviewLog(
            rating=SrsRating(int(log.rating)),
            review_datetime=log.review_datetime,
        )
