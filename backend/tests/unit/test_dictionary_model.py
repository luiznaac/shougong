from __future__ import annotations

from shougong.usecase.dictionary.model import derive_handwriting_level

_LEVELS = {"班": 2, "爱": 1, "人": 1}


def test_the_handwriting_rollup_is_the_max_of_the_characters_that_have_a_level() -> None:
    assert derive_handwriting_level("爱人", _LEVELS) == 1
    assert derive_handwriting_level("班", _LEVELS) == 2
    assert derive_handwriting_level("上班", _LEVELS) == 2


def test_the_handwriting_rollup_is_none_when_no_character_has_a_level() -> None:
    assert derive_handwriting_level("水", _LEVELS) is None
    assert derive_handwriting_level("", {}) is None
