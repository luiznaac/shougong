"""Dialogue-consistency checks — pure, stdlib only.

A dialogue reading comes back as a `lines` array of {speaker, text} turns plus
the running `text`. These checks catch the ways the model breaks that shape;
any failure is fed back into the correction loop, like an out-of-vocabulary
word. Repairing a malformed `lines` array (rather than rejecting the draft) is
a later increment.
"""

from __future__ import annotations

from collections.abc import Sequence
from itertools import pairwise

from shougong.usecase.reading.gateway import DialogueLine

_TURN_END = "。！？!?、,… \n\t"  # noqa: RUF001 - trailing Mandarin sentence punctuation, intentional


def check_dialogue(lines: Sequence[DialogueLine], running_text: str, speakers_allowed: frozenset[str]) -> list[str]:
    """Problems with the turn breakdown — empty means it is consistent."""
    if not lines:
        return ["The dialogue has no lines array — return every turn in lines."]

    problems: list[str] = []

    unknown = sorted({line.speaker for line in lines if line.speaker not in speakers_allowed})
    if unknown:
        allowed = ", ".join(sorted(speakers_allowed))
        problems.append(f"These speakers are not allowed: {', '.join(unknown)}. Use only these names: {allowed}.")

    if len({line.speaker for line in lines}) < 2:
        problems.append("A dialogue needs at least two different speakers.")

    if any(a.speaker == b.speaker for a, b in pairwise(lines)):
        problems.append("The same speaker takes two turns in a row — alternate speakers.")

    uncovered = [
        line.text for line in lines if line.text.strip(_TURN_END) and line.text.strip(_TURN_END) not in running_text
    ]
    if uncovered:
        problems.append(f"These turns are missing from the running text: {' / '.join(uncovered)}.")

    return problems
