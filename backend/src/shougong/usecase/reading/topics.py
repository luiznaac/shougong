"""Topic resolution for reading generation — pure, stdlib only.

When the learner leaves the free-text topic blank, the code picks a concrete
scenario (with a small arc) from the curated list rather than sending "something
everyday", which the model turns into the same empty facts every time (spec
§2.2). Recently used scenarios are skipped so successive texts differ.
"""

from __future__ import annotations

import random
from collections.abc import Sequence
from dataclasses import dataclass

_EVERYDAY_FALLBACK = "free choice, something everyday"


@dataclass(frozen=True, slots=True)
class ResolvedTopic:
    text: str
    generated: bool  # True → drawn from the scenario list; False → the learner's own text


def resolve_topic(
    user_topic: str | None,
    scenarios: Sequence[str],
    recent: Sequence[str],
    rng: random.Random,
) -> ResolvedTopic:
    if user_topic and user_topic.strip():
        return ResolvedTopic(text=user_topic.strip(), generated=False)

    if not scenarios:
        return ResolvedTopic(text=_EVERYDAY_FALLBACK, generated=False)

    seen = {r.strip().lower() for r in recent}
    fresh = [s for s in scenarios if s.strip().lower() not in seen]
    return ResolvedTopic(text=rng.choice(fresh or list(scenarios)), generated=True)
