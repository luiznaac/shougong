from __future__ import annotations

import pytest

from shougong.usecase.reading.validation import is_chinese_word, out_of_vocabulary


@pytest.mark.parametrize("value", ["学", "学习", "人工"])
def test_is_chinese_word_accepts_hanzi(value: str) -> None:
    assert is_chinese_word(value) is True


@pytest.mark.parametrize("value", ["", "、", "\n", "ABC", "学1", " 学"])
def test_is_chinese_word_rejects_anything_else(value: str) -> None:
    assert is_chinese_word(value) is False


def test_out_of_vocabulary_flags_words_not_in_the_known_set() -> None:
    tokens = ["我", "是", "学生", "。"]
    assert out_of_vocabulary(tokens, frozenset({"我", "是"})) == ["学生"]


def test_out_of_vocabulary_returns_distinct_and_sorted() -> None:
    tokens = ["猫", "和", "狗", "和", "猫"]
    assert out_of_vocabulary(tokens, frozenset({"和"})) == ["狗", "猫"]


def test_out_of_vocabulary_ignores_punctuation_and_non_hanzi() -> None:
    tokens = ["我", "、", "\n", "OK", "。"]
    assert out_of_vocabulary(tokens, frozenset({"我"})) == []


def test_an_unknown_compound_surfaces_whole_not_as_its_known_characters() -> None:
    # The segmenter produced 分钟 as one token; the learner knows 分 and 钟
    # separately but not 分钟 — it must be reported as 分钟, not hidden.
    tokens = ["等", "了", "十", "分钟", "。"]
    known = frozenset({"等", "了", "十", "分", "钟"})
    assert out_of_vocabulary(tokens, known) == ["分钟"]


def test_a_studied_compound_wins_over_its_parts_when_the_segmenter_splits_it() -> None:
    # The segmenter split 北京大学 into 北京 + 大学; the learner studied the whole
    # thing, so nothing should be flagged.
    tokens = ["北京", "大学", "很", "大"]
    known = frozenset({"北京大学", "很", "大"})
    assert out_of_vocabulary(tokens, known) == []


def test_a_single_unknown_character_is_flagged() -> None:
    assert out_of_vocabulary(["我", "叽"], frozenset({"我"})) == ["叽"]
