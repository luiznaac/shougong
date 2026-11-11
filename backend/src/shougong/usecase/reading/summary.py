"""Derived list-row figures for a saved reading.

A `ReadingSummary` never carries the token/attempt payload; these helpers keep
the derivation (preview, entry-match snippet, extra-word count) in one pure
place shared by the list projection and the tests.
"""

from __future__ import annotations

from collections.abc import Sequence

from shougong.usecase.reading.model import (
    GenerationAttempt,
    ReadingMatch,
    ReadingToken,
    ReadingWord,
)

PREVIEW_CHARACTERS = 48
MATCH_CONTEXT_TOKENS = 12


def preview(tokens: Sequence[ReadingToken]) -> str:
    """The first 48 characters of the concatenated token text."""
    return "".join(token.text for token in tokens)[:PREVIEW_CHARACTERS]


def match_snippet(tokens: Sequence[ReadingToken], text: str) -> ReadingMatch | None:
    """The token slice around the first occurrence of `text`, punctuation
    included and clamped to the article edges; `None` when absent."""
    for index, token in enumerate(tokens):
        if isinstance(token, ReadingWord) and token.text == text:
            start = max(0, index - MATCH_CONTEXT_TOKENS)
            end = index + MATCH_CONTEXT_TOKENS + 1
            before = "".join(t.text for t in tokens[start:index])
            after = "".join(t.text for t in tokens[index + 1 : end])
            return ReadingMatch(before=before, hit=token.text, after=after)
    return None


def extra_word_count(tokens: Sequence[ReadingToken], attempts: Sequence[GenerationAttempt]) -> int:
    """The chosen draft's own extra-word count; rows written before the
    correction loop have no trail, so fall back to their distinct flagged
    words — the same de-duplication `SavedReadingTextResponse` applies."""
    chosen = next((attempt for attempt in attempts if attempt.chosen), None)
    if chosen is not None:
        return len(chosen.extra_words)
    return len({token.text for token in tokens if isinstance(token, ReadingWord) and token.is_extra})
