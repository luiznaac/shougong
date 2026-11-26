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
from shougong.usecase.study.model import BatchImportOutcome


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


@dataclass(frozen=True, slots=True)
class HanziHeroExports:
    """The three simplified-course exports, fetched whole before any import.

    Raw CSV text: parsing is a pure concern of the `export` module, kept apart
    from the HTTP adapter so a changed CSV shape is a parser failure, not a
    transport one.
    """

    characters: str
    words: str
    dictionary: str


@dataclass(frozen=True, slots=True)
class HanziHeroSyncRow:
    """One known HanziHero item, already transformed to shougong's numbered-pinyin shape."""

    hanzi: str
    pinyin: str


@dataclass(frozen=True, slots=True)
class HanziHeroSyncReport:
    """What a sync run did: the instant it stamped and the per-row batch outcomes."""

    synced_at: datetime
    outcomes: tuple[BatchImportOutcome, ...]


class HanziHeroAuthenticationError(DomainError):
    """HanziHero rejected the supplied email/username or password."""


class HanziHeroNotConnectedError(DomainError):
    """A sync was requested while no HanziHero session is stored."""


class HanziHeroSessionExpiredError(DomainError):
    """The stored session is stale: HanziHero answered a request with its login redirect."""


class HanziHeroUnavailableError(DomainError):
    """HanziHero could not be reached or returned a response we cannot use."""


class HanziHeroExportFormatError(HanziHeroUnavailableError):
    """An export's CSV shape is not what the parser expects — fail loudly, import nothing."""
