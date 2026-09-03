"""Injectable clock — the equivalent of `TimeProviderConfig` in the Kotlin family.

Depend on `IClock` anywhere you need the current time so tests can freeze it.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Protocol, runtime_checkable
from zoneinfo import ZoneInfo


@runtime_checkable
class IClock(Protocol):
    def now(self) -> datetime: ...


def start_of_day(moment: datetime, tz: ZoneInfo) -> datetime:
    """Midnight (in `tz`) of the calendar day `moment` falls on, as a UTC datetime.

    Used to snap SRS due times to a day boundary so a whole day's cards become
    due at once rather than trickling in through the day.
    """
    local_midnight = moment.astimezone(tz).replace(hour=0, minute=0, second=0, microsecond=0)
    return local_midnight.astimezone(UTC)


class SystemClock(IClock):
    """Production clock. Swap for a fixed clock in tests."""

    def now(self) -> datetime:
        return datetime.now(tz=UTC)


class FixedClock(IClock):
    """Test double: always returns the same instant."""

    def __init__(self, instant: datetime) -> None:
        self._instant = instant

    def now(self) -> datetime:
        return self._instant
