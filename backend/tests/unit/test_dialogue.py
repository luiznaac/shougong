from __future__ import annotations

from shougong.usecase.reading.dialogue import check_dialogue
from shougong.usecase.reading.gateway import DialogueLine

_ALLOWED = frozenset({"哥哥", "妹妹"})


def _lines(*pairs: tuple[str, str]) -> list[DialogueLine]:
    return [DialogueLine(speaker=s, text=t) for s, t in pairs]


def test_a_well_formed_dialogue_has_no_problems() -> None:
    lines = _lines(("哥哥", "你好。"), ("妹妹", "你好吗?"), ("哥哥", "很好。"))
    running = "你好。你好吗?很好。"

    assert check_dialogue(lines, running, _ALLOWED) == []


def test_missing_lines_array_is_a_problem() -> None:
    assert check_dialogue([], "你好。", _ALLOWED) == ["The dialogue has no lines array — return every turn in lines."]


def test_a_speaker_outside_the_list_is_flagged_with_the_allowed_names() -> None:
    lines = _lines(("哥哥", "你好。"), ("小明", "你好。"))
    problems = check_dialogue(lines, "你好。你好。", _ALLOWED)

    assert any("小明" in p and "哥哥" in p and "妹妹" in p for p in problems)


def test_a_single_speaker_is_flagged() -> None:
    lines = _lines(("哥哥", "你好。"), ("哥哥", "再见。"))
    problems = check_dialogue(lines, "你好。再见。", _ALLOWED)

    assert "A dialogue needs at least two different speakers." in problems
    assert any("two turns in a row" in p for p in problems)


def test_a_turn_missing_from_the_running_text_is_flagged() -> None:
    lines = _lines(("哥哥", "你好。"), ("妹妹", "我要去学校。"))
    problems = check_dialogue(lines, "你好。", _ALLOWED)

    assert any("missing from the running text" in p for p in problems)
