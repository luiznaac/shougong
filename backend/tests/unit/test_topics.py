from __future__ import annotations

import random

from shougong.usecase.reading.topics import resolve_topic

_SCENARIOS = ["a lost key", "a broken lift", "a late bus", "a wrong package"]


def test_a_user_topic_is_taken_verbatim_and_not_marked_generated() -> None:
    resolved = resolve_topic("  viagem de trem  ", _SCENARIOS, [], random.Random(0))

    assert resolved.text == "viagem de trem"
    assert resolved.generated is False


def test_a_blank_topic_draws_a_scenario_and_is_marked_generated() -> None:
    resolved = resolve_topic("   ", _SCENARIOS, [], random.Random(0))

    assert resolved.text in _SCENARIOS
    assert resolved.generated is True


def test_recently_used_scenarios_are_skipped() -> None:
    recent = ["A LOST KEY", "a broken lift", "a late bus"]

    picks = {resolve_topic(None, _SCENARIOS, recent, random.Random(s)).text for s in range(20)}

    assert picks == {"a wrong package"}  # the only one not in `recent` (case-insensitive)


def test_when_every_scenario_is_recent_it_still_returns_one() -> None:
    resolved = resolve_topic(None, _SCENARIOS, _SCENARIOS, random.Random(0))

    assert resolved.text in _SCENARIOS
    assert resolved.generated is True


def test_no_scenarios_falls_back_to_the_everyday_default() -> None:
    resolved = resolve_topic(None, [], [], random.Random(0))

    assert resolved.text == "free choice, something everyday"
    assert resolved.generated is False
