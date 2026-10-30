"""`RandomShuffler` — implements `IShuffler` over the system random source."""

from __future__ import annotations

import random
from collections.abc import Sequence

from shougong.usecase.study.model import StudyItem
from shougong.usecase.study.shuffler import IShuffler


class RandomShuffler(IShuffler):
    def __init__(self) -> None:
        self._rng = random.SystemRandom()

    def shuffle(self, items: Sequence[StudyItem]) -> list[StudyItem]:
        shuffled = list(items)
        self._rng.shuffle(shuffled)
        return shuffled
