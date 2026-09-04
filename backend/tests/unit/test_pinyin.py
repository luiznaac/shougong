from __future__ import annotations

import pytest

from shougong.usecase.dictionary.pinyin import sanitize_pinyin


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
