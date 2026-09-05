from __future__ import annotations

import pytest

from shougong.usecase.reading.validation import distinct_extra_words, is_chinese_word


@pytest.mark.parametrize("value", ["学", "学习", "人工"])
def test_is_chinese_word_accepts_hanzi(value: str) -> None:
    assert is_chinese_word(value) is True


@pytest.mark.parametrize("value", ["", "、", "\n", "ABC", "学1", " 学"])
def test_is_chinese_word_rejects_anything_else(value: str) -> None:
    assert is_chinese_word(value) is False


def test_distinct_extra_words_ignores_punctuation_and_known_words() -> None:
    known = frozenset({"我", "是", "学生"})
    tokens = ["我", "是", "、", "学生", "。"]

    assert distinct_extra_words(tokens, known) == ()


def test_distinct_extra_words_checks_the_whole_word_not_its_characters() -> None:
    # "人" and "工" are individually known, but "人工" as a compound is not.
    known = frozenset({"人", "工"})

    assert distinct_extra_words(["人", "工", "人工"], known) == ("人工",)


def test_distinct_extra_words_deduplicates_in_first_seen_order() -> None:
    known: frozenset[str] = frozenset()

    assert distinct_extra_words(["猫", "狗", "猫"], known) == ("猫", "狗")
