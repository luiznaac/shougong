"""Study-item-history domain model.

A `StudyItemHistory` row is a snapshot of a `StudyItem`'s scheduling state, kept
when the item is created and after every change. The trail is append-only and read
back newest first.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from shougong.usecase.dictionary.model import DictionaryEntry
from shougong.usecase.srs.model import SrsCard


@dataclass(frozen=True, slots=True)
class StudyItemHistory:
    """A study item's state at one moment, recorded when the item is created and
    after every change. `created_at` is when this history row was written (not the
    study item's own creation time).
    """

    study_item_id: int
    entry: DictionaryEntry
    card: SrsCard
    created_at: datetime
