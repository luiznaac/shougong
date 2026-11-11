from __future__ import annotations

from shougong.usecase.reading.model import (
    GenerationAttempt,
    ReadingPunctuation,
    ReadingToken,
    ReadingWord,
)
from shougong.usecase.reading.summary import extra_word_count, match_snippet, preview


def _word(text: str, *, is_extra: bool = False) -> ReadingWord:
    return ReadingWord(
        text=text,
        pinyin=None,
        definitions=(),
        part_of_speech=None,
        is_extra=is_extra,
        dictionary_entry_id=None,
    )


def _punct(text: str) -> ReadingPunctuation:
    return ReadingPunctuation(text=text)


def _attempt(*, extra_words: tuple[str, ...], chosen: bool) -> GenerationAttempt:
    return GenerationAttempt(
        text="",
        segmentation=(),
        extra_words=extra_words,
        prompt_tokens=0,
        completion_tokens=0,
        chosen=chosen,
    )


def test_preview_joins_token_text_and_clamps_to_48_characters() -> None:
    tokens: tuple[ReadingToken, ...] = (_word("学"), _word("生"), _punct("，"), _word("好"))

    assert preview(tokens) == "学生，好"
    assert preview((_word("字" * 60),)) == "字" * 48


def test_match_snippet_clamps_the_window_at_both_edges() -> None:
    before = tuple(_word(f"前{i}") for i in range(20))
    after = tuple(_word(f"后{i}") for i in range(20))
    tokens: tuple[ReadingToken, ...] = (*before, _word("学生"), *after)

    match = match_snippet(tokens, "学生")

    assert match is not None
    assert match.hit == "学生"
    # 12 tokens each side, punctuation included, clamped to the article edges.
    assert match.before == "".join(t.text for t in before[-12:])
    assert match.after == "".join(t.text for t in after[:12])
    assert not match.before.startswith("前0")


def test_match_snippet_keeps_punctuation_inside_the_slice() -> None:
    tokens: tuple[ReadingToken, ...] = (
        _word("我"),
        _punct("，"),
        _word("知道"),
        _punct("。"),
        _word("他"),
    )

    match = match_snippet(tokens, "知道")

    assert match is not None
    assert (match.before, match.hit, match.after) == ("我，", "知道", "。他")


def test_match_snippet_is_none_when_the_word_is_absent() -> None:
    assert match_snippet((_word("我"), _punct("。")), "知道") is None


def test_match_snippet_uses_the_first_occurrence() -> None:
    tokens: tuple[ReadingToken, ...] = (_word("知道"), _punct("，"), _word("知道"))

    match = match_snippet(tokens, "知道")

    assert match is not None
    assert match.before == ""
    assert match.after == "，知道"


def test_extra_word_count_prefers_the_chosen_drafts_own_count() -> None:
    attempts = (
        _attempt(extra_words=("猫", "狗"), chosen=False),
        _attempt(extra_words=("猫",), chosen=True),
    )

    assert extra_word_count((), attempts) == 1


def test_extra_word_count_falls_back_to_distinct_flagged_tokens_on_rows_before_the_trail() -> None:
    tokens: tuple[ReadingToken, ...] = (
        _word("我"),
        _word("猫", is_extra=True),
        _punct("。"),
        _word("猫", is_extra=True),
    )

    assert extra_word_count(tokens, ()) == 1
