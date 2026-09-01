"""`ISrsEngine` — the boundary to the spaced-repetition algorithm (FSRS).

Everything the app needs from FSRS without importing it: mint a fresh card and
advance a card given a rating. Pure and synchronous. Implemented by
`shougong.srs.fsrs_engine.FsrsEngine`.
"""

from __future__ import annotations

from datetime import datetime
from typing import Protocol

from shougong.usecase.srs.model import SrsCard, SrsRating, SrsReviewLog


class ISrsEngine(Protocol):
    def new_card(self, now: datetime) -> SrsCard: ...

    def review(self, card: SrsCard, rating: SrsRating, now: datetime) -> tuple[SrsCard, SrsReviewLog]: ...
