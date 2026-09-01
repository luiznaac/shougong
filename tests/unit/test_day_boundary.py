from __future__ import annotations

from datetime import UTC, datetime
from zoneinfo import ZoneInfo

from shougong.usecase.srs.day_boundary import DayBoundaryEngine
from shougong.usecase.srs.model import SrsRating
from tests.fixtures import StubSrsEngine, make_srs_card

_AFTERNOON = datetime(2026, 3, 4, 15, 30, tzinfo=UTC)


def test_new_card_due_is_snapped_to_midnight() -> None:
    engine = DayBoundaryEngine(StubSrsEngine(), ZoneInfo("UTC"))

    card = engine.new_card(_AFTERNOON)

    assert card.due == datetime(2026, 3, 4, 0, 0, tzinfo=UTC)


def test_review_due_is_snapped_and_the_log_is_untouched() -> None:
    engine = DayBoundaryEngine(StubSrsEngine(), ZoneInfo("UTC"))
    # StubSrsEngine.review returns due = now + 1 day.
    updated, log = engine.review(make_srs_card(), SrsRating.GOOD, _AFTERNOON)

    assert updated.due == datetime(2026, 3, 5, 0, 0, tzinfo=UTC)
    assert log.rating is SrsRating.GOOD
    assert log.review_datetime == _AFTERNOON


def test_midnight_is_local_not_utc() -> None:
    # 01:00 UTC is still the previous day in Sao Paulo (UTC-3): 22:00.
    engine = DayBoundaryEngine(StubSrsEngine(), ZoneInfo("America/Sao_Paulo"))

    card = engine.new_card(datetime(2026, 3, 4, 1, 0, tzinfo=UTC))

    # Local midnight of Mar 3 == 03:00 UTC Mar 3.
    assert card.due == datetime(2026, 3, 3, 3, 0, tzinfo=UTC)
