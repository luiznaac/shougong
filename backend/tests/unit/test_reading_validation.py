from __future__ import annotations

import pytest

from shougong.usecase.reading.validation import is_chinese_word


@pytest.mark.parametrize("value", ["学", "学习", "人工"])
def test_is_chinese_word_accepts_hanzi(value: str) -> None:
    assert is_chinese_word(value) is True


@pytest.mark.parametrize("value", ["", "、", "\n", "ABC", "学1", " 学"])
def test_is_chinese_word_rejects_anything_else(value: str) -> None:
    assert is_chinese_word(value) is False
