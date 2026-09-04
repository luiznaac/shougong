"""Domain model for per-character stroke order data."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True, slots=True)
class CharacterStrokes:
    character: str
    strokes: tuple[str, ...]  # SVG path 'd' strings, in drawing order
    medians: tuple[tuple[tuple[float, float], ...], ...]  # per-stroke [x, y] points


@dataclass(frozen=True, slots=True)
class StrokeLookupResult:
    """A cache row. `strokes=None` is a *confirmed* prior miss (e.g. punctuation
    with no stroke data) — distinct from "never looked up", which the repository
    signals by returning `None` instead of a `StrokeLookupResult`.
    """

    character: str
    strokes: CharacterStrokes | None
