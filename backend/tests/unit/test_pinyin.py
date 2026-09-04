from __future__ import annotations

import pytest

from shougong.usecase.dictionary.pinyin import is_numbered_pinyin, sanitize_pinyin


@pytest.mark.parametrize(
    "value",
    [
        "xue2 xi2",
        "ni3 hao3",
        "de5",
        "lu:4",
        "lu:e4",
        "Bei3 jing1",  # proper-noun capitalisation is accepted as-is
    ],
)
def test_accepts_numbered_pinyin(value: str) -> None:
    assert is_numbered_pinyin(value) is True


@pytest.mark.parametrize(
    "value",
    [
        "",
        "xue",  # no tone
        "xué xí",  # tone marks, not numbers
        "xuexi",  # no separator, no tones
        "xue2  xi2",  # double space
        " xue2 xi2",  # leading space
        "xue2 xi2 ",  # trailing space
        "xue6",  # tone out of range
        "xue2xi2",  # missing separator
    ],
)
def test_rejects_anything_else(value: str) -> None:
    assert is_numbered_pinyin(value) is False


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("xue2 xi2", "xue2 xi2"),
        ("Bei3 jing1", "bei3 jing1"),
        ("lu:4 xing2", "lv4 xing2"),
        ("lu:e4", "lve4"),
        ("LU:4", "lv4"),
        ("nü3", "nv3"),
        ("", ""),
    ],
)
def test_sanitize_pinyin_lowercases_and_rewrites_u(raw: str, expected: str) -> None:
    assert sanitize_pinyin(raw) == expected
