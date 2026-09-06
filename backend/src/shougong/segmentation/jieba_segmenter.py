"""`JiebaSegmenter` — implements `ISegmenter` on top of `jieba`.

This is the ONLY module allowed to import `jieba`, mirroring how
`shougong.srs.fsrs_engine` is the only place allowed to import `fsrs`: a pure,
third-party algorithmic dependency stays out of `usecase` and is wrapped at the
boundary instead.

`jieba.posseg` segments and POS-tags in one pass, so a single call gives us
both the token stream and its grammatical-class tag — translated to this app's
own `PartOfSpeech` via `jieba_pos.part_of_speech_for_tag` before it ever
leaves this module; nothing outside `segmentation` sees jieba's raw tag.
"""

from __future__ import annotations

import logging

import jieba
import jieba.posseg as pseg

from shougong.segmentation.jieba_pos import part_of_speech_for_tag
from shougong.usecase.reading.gateway import ISegmenter, SegmentedToken


def warm_up() -> None:
    """Force jieba's lazy dictionary load now, and quiet its own logging.

    jieba loads its dictionary (~1s) on first use and logs through the stdlib
    `logging` module by default; call this once at startup so the first real
    request isn't penalised and jieba's logs don't interleave with structlog.
    """
    jieba.setLogLevel(logging.WARNING)
    jieba.initialize()


class JiebaSegmenter(ISegmenter):
    def segment(self, text: str) -> tuple[SegmentedToken, ...]:
        return tuple(
            SegmentedToken(text=word, part_of_speech=part_of_speech_for_tag(flag)) for word, flag in pseg.cut(text)
        )
