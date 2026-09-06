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


class PartOfSpeech(StrEnum):
    """Grammatical class of a word, in this app's own vocabulary — never a raw
    tag from whatever segmentation library resolves it (see `ISegmenter`).
    Backend stays English-only; the frontend translates this for display."""

    NOUN = "noun"
    VERB = "verb"
    ADJECTIVE = "adjective"
    ADVERB = "adverb"
    PRONOUN = "pronoun"
    NUMERAL = "numeral"
    QUANTIFIER = "quantifier"
    PREPOSITION = "preposition"
    CONJUNCTION = "conjunction"
    PARTICLE = "particle"
    OTHER = "other"


@dataclass(frozen=True, slots=True)
class ReadingRequest:
    format: ReadingFormat
    max_extra_words: int
    model: str  # LiteLLM model id the caller picked; always supplied by the client
    topic: str | None = None


@dataclass(frozen=True, slots=True)
class ReadingWord:
    text: str
    pinyin: str | None  # None only when no dictionary entry exists at all
    definitions: tuple[str, ...]
    part_of_speech: PartOfSpeech | None  # None for punctuation or an unresolved tag
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
    known_word_count: int  # size of the known-vocabulary set sent to the model


@dataclass(frozen=True, slots=True)
class SavedReadingText:
    id: int
    request: ReadingRequest
    reading: GeneratedReading
    created_at: datetime
