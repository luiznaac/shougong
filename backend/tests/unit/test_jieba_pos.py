from __future__ import annotations

import pytest

from shougong.segmentation.jieba_pos import part_of_speech_for_tag
from shougong.usecase.reading.model import PartOfSpeech


@pytest.mark.parametrize(
    ("tag", "expected"),
    [
        ("n", PartOfSpeech.NOUN),
        ("nr", PartOfSpeech.NOUN),  # person name, still a noun family
        ("ns", PartOfSpeech.NOUN),  # place name
        ("v", PartOfSpeech.VERB),
        ("vn", PartOfSpeech.VERB),
        ("a", PartOfSpeech.ADJECTIVE),
        ("ad", PartOfSpeech.ADJECTIVE),
        ("d", PartOfSpeech.ADVERB),
        ("r", PartOfSpeech.PRONOUN),
        ("m", PartOfSpeech.NUMERAL),
        ("q", PartOfSpeech.QUANTIFIER),
        ("p", PartOfSpeech.PREPOSITION),
        ("c", PartOfSpeech.CONJUNCTION),
        ("u", PartOfSpeech.PARTICLE),
    ],
)
def test_part_of_speech_for_tag_maps_known_prefixes(tag: str, expected: PartOfSpeech) -> None:
    assert part_of_speech_for_tag(tag) == expected


@pytest.mark.parametrize("tag", ["w", "x"])
def test_part_of_speech_for_tag_treats_punctuation_as_none(tag: str) -> None:
    assert part_of_speech_for_tag(tag) is None


def test_part_of_speech_for_tag_unknown_prefix_falls_back_to_other() -> None:
    assert part_of_speech_for_tag("zzz") is PartOfSpeech.OTHER
