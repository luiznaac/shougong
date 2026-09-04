"""Outbound ports for the strokes slice. Implemented in the adapters."""

from __future__ import annotations

from typing import Protocol

from shougong.usecase.strokes.model import CharacterStrokes, StrokeLookupResult


class IStrokeRepository(Protocol):
    async def find(self, character: str) -> StrokeLookupResult | None:
        """`None` means the character was never looked up before (cache miss)."""
        ...

    async def save(self, character: str, strokes: CharacterStrokes | None) -> None:
        """Persist a hit (`strokes` set) or a negative-cache miss (`strokes=None`)."""
        ...


class IHanziStrokeSource(Protocol):
    """Fetches one character's stroke data from its upstream (hanzi-writer-data)."""

    async def fetch(self, character: str) -> CharacterStrokes | None:
        """`None` if the upstream has no data for this character."""
        ...
