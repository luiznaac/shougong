"""`ISrsScheduler` — the spaced-repetition scheduling port.

Pure and synchronous: given a card, a rating and the current time it returns the
next card state. Implemented by `shougong.srs.fsrs_scheduler.FsrsScheduler`.
"""

from __future__ import annotations

from datetime import datetime
from typing import Protocol

from shougong.usecase.srs.model import SrsCard, SrsRating, SrsReviewLog


class ISrsScheduler(Protocol):
    def new_card(self, now: datetime) -> SrsCard: ...

    def review(self, card: SrsCard, rating: SrsRating, now: datetime) -> tuple[SrsCard, SrsReviewLog]: ...
