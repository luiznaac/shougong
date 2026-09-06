"""Translates jieba's POS tags into this app's own `PartOfSpeech` enum.

jieba tags with a compact ICTCLAS-style tag set (e.g. `n` noun, `ns` place
name, `v` verb) — a detail of that specific library. Nothing outside
`shougong.segmentation` should ever see one of these raw tag strings; every
caller (`usecase.reading`, and beyond) only ever sees `PartOfSpeech`.
"""

from __future__ import annotations

from shougong.usecase.reading.model import PartOfSpeech

_PREFIX_TO_PART_OF_SPEECH: tuple[tuple[str, PartOfSpeech], ...] = (
    ("n", PartOfSpeech.NOUN),
    ("v", PartOfSpeech.VERB),
    ("a", PartOfSpeech.ADJECTIVE),
    ("d", PartOfSpeech.ADVERB),
    ("r", PartOfSpeech.PRONOUN),
    ("m", PartOfSpeech.NUMERAL),
    ("q", PartOfSpeech.QUANTIFIER),
    ("p", PartOfSpeech.PREPOSITION),
    ("c", PartOfSpeech.CONJUNCTION),
    ("u", PartOfSpeech.PARTICLE),
)

_PUNCTUATION_PREFIXES = ("w", "x")


def part_of_speech_for_tag(tag: str) -> PartOfSpeech | None:
    """The `PartOfSpeech` a jieba tag maps to, or `None` for punctuation."""
    if tag.startswith(_PUNCTUATION_PREFIXES):
        return None
    for prefix, part_of_speech in _PREFIX_TO_PART_OF_SPEECH:
        if tag.startswith(prefix):
            return part_of_speech
    return PartOfSpeech.OTHER
