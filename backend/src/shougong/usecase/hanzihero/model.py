"""Domain model for the HanziHero sync connection.

The connection is a single learner-level row: only the authenticated session
cookie HanziHero issued and the instants it was connected and last synced. The
email/username and password used to log in are never part of the domain — they
travel to the login gateway and nowhere else.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from shougong.usecase.commons.exceptions import DomainError


@dataclass(frozen=True, slots=True)
class HanziHeroConnection:
    """The stored connection: a bearer session cookie plus its audit instants."""

    session_cookie: str
    connected_at: datetime
    last_synced_at: datetime | None


@dataclass(frozen=True, slots=True)
class HanziHeroStatus:
    """The connection status. `connected_at` is null while no session is stored
    (that null *is* the disconnected state); `last_synced_at` stays null until the
    first sync."""

    connected_at: datetime | None
    last_synced_at: datetime | None


class HanziHeroAuthenticationError(DomainError):
    """HanziHero rejected the supplied email/username or password."""


class HanziHeroUnavailableError(DomainError):
    """HanziHero could not be reached or returned a response we cannot use."""
