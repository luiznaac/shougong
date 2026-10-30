"""Timestamp conversions at the persistence seam.

Domain times are timezone-aware UTC; MySQL stores naive datetimes, so every
repository converting between the two uses these helpers instead of re-declaring
the two-line conversion.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import overload


def naive_utc(value: datetime) -> datetime:
    """Convert an aware datetime to naive UTC for storage."""
    return value.astimezone(UTC).replace(tzinfo=None)


@overload
def as_utc(value: datetime) -> datetime: ...


@overload
def as_utc(value: None) -> None: ...


def as_utc(value: datetime | None) -> datetime | None:
    """Re-attach UTC to a naive stored datetime; `None` passes through."""
    if value is None:
        return None
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)
