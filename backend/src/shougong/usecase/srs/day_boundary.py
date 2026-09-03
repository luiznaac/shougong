"""`DayBoundaryEngine` — snaps every card's due time down to the start of its day.

Decorates another `ISrsEngine`. With this in place a day's worth of cards all
come due at local midnight instead of trickling in through the day, which suits
sitting down to study once a day. The cost is a little scheduling precision, and
rounding *down* means cards come due slightly earlier than FSRS intended.
"""

from __future__ import annotations

from dataclasses import replace
from datetime import datetime
from zoneinfo import ZoneInfo

from shougong.usecase.commons.time import start_of_day
from shougong.usecase.srs.engine import ISrsEngine
from shougong.usecase.srs.model import SrsCard, SrsRating, SrsReviewLog


class DayBoundaryEngine(ISrsEngine):
    def __init__(self, inner: ISrsEngine, tz: ZoneInfo) -> None:
        self._inner = inner
        self._tz = tz

    def new_card(self, now: datetime) -> SrsCard:
        return self._snap(self._inner.new_card(now))

    def review(self, card: SrsCard, rating: SrsRating, now: datetime) -> tuple[SrsCard, SrsReviewLog]:
        updated, log = self._inner.review(card, rating, now)
        return self._snap(updated), log

    def _snap(self, card: SrsCard) -> SrsCard:
        return replace(card, due=start_of_day(card.due, self._tz))
