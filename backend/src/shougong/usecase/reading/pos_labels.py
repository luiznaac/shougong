"""Grammatical-class labels for jieba's POS tagger output.

jieba tags with a compact ICTCLAS-style tag set (e.g. `n` noun, `ns` place
name, `v` verb). This maps the tags this app cares about to a short
Portuguese label shown next to a word; pure stdlib, no jieba import — the
tagger itself lives behind `ISegmenter` in `shougong.segmentation`.
"""

from __future__ import annotations

_PREFIX_LABELS: tuple[tuple[str, str], ...] = (
    ("n", "substantivo"),
    ("v", "verbo"),
    ("a", "adjetivo"),
    ("d", "advérbio"),
    ("r", "pronome"),
    ("m", "numeral"),
    ("q", "quantificador"),
    ("p", "preposição"),
    ("c", "conjunção"),
    ("u", "partícula"),
)

_PUNCTUATION_PREFIXES = ("w", "x")


def label_for_tag(tag: str | None) -> str | None:
    """A Portuguese label for a jieba POS tag, or `None` for punctuation/unknown."""
    if not tag or tag.startswith(_PUNCTUATION_PREFIXES):
        return None
    for prefix, label in _PREFIX_LABELS:
        if tag.startswith(prefix):
            return label
    return "outro"
