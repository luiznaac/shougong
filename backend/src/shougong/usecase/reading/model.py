"""Reading-practice domain model.

A `GeneratedReading` is a Mandarin text restricted to a learner's known
vocabulary, produced by an LLM and validated locally. It is deliberately
translation-free: pinyin and definitions come from the app's own dictionary,
never from the model.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum

from shougong.usecase.commons.exceptions import DomainError


class ReadingGenerationError(DomainError):
    """The AI gateway failed to produce usable text."""


class ReadingFormat(StrEnum):
    PARAGRAPH = "paragraph"
    SENTENCES = "sentences"


@dataclass(frozen=True, slots=True)
class ReadingRequest:
    format: ReadingFormat
    max_extra_words: int
    topic: str | None = None


@dataclass(frozen=True, slots=True)
class ReadingWord:
    text: str
    pinyin: str | None  # None only when no dictionary entry exists at all
    definitions: tuple[str, ...]
    part_of_speech: str | None  # human-readable label, see pos_labels.label_for_tag
    is_extra: bool  # not in the learner's known vocabulary
    # None only when no dictionary entry exists at all; lets an extra word be
    # added straight to the study queue (`POST /study-items`) from the reading.
    dictionary_entry_id: int | None


@dataclass(frozen=True, slots=True)
class ReadingPunctuation:
    """A non-word token (punctuation, whitespace, newline), passed through verbatim."""

    text: str


type ReadingToken = ReadingWord | ReadingPunctuation


@dataclass(frozen=True, slots=True)
class GeneratedReading:
    format: ReadingFormat
    tokens: tuple[ReadingToken, ...]
    extra_word_count: int  # count of distinct extra words
    extra_char_count: int  # total characters across every extra-word occurrence
    known_word_count: int  # size of the known-vocabulary set sent to the model
    known_words_char_count: int  # total characters across that vocabulary
    attempts: int  # how many attempts the AI gateway needed to converge


@dataclass(frozen=True, slots=True)
class SavedReadingText:
    id: int
    request: ReadingRequest
    reading: GeneratedReading
    created_at: datetime
