from __future__ import annotations

import pytest

from shougong.usecase.reading.pos_labels import label_for_tag


@pytest.mark.parametrize(
    ("tag", "expected"),
    [
        ("n", "substantivo"),
        ("nr", "substantivo"),  # person name, still a noun family
        ("ns", "substantivo"),  # place name
        ("v", "verbo"),
        ("vn", "verbo"),
        ("a", "adjetivo"),
        ("ad", "adjetivo"),
        ("d", "advérbio"),
        ("r", "pronome"),
        ("m", "numeral"),
        ("q", "quantificador"),
        ("p", "preposição"),
        ("c", "conjunção"),
        ("u", "partícula"),
    ],
)
def test_label_for_tag_maps_known_prefixes(tag: str, expected: str) -> None:
    assert label_for_tag(tag) == expected


@pytest.mark.parametrize("tag", ["w", "x"])
def test_label_for_tag_treats_punctuation_as_no_label(tag: str) -> None:
    assert label_for_tag(tag) is None


def test_label_for_tag_none_is_no_label() -> None:
    assert label_for_tag(None) is None


def test_label_for_tag_unknown_prefix_falls_back_to_outro() -> None:
    assert label_for_tag("zzz") == "outro"
