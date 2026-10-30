"""Outbound port for shuffling a block of study items. Implemented in `randomization`."""

from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol

from shougong.usecase.study.model import StudyItem


class IShuffler(Protocol):
    """Returns a shuffled copy of the given items; never mutates the input."""

    def shuffle(self, items: Sequence[StudyItem]) -> list[StudyItem]: ...
