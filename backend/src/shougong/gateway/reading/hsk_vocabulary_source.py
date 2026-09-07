"""`HskVocabularySource` — downloads the HSK word list from `complete-hsk-vocabulary`.

The upstream is a single JSON array (`complete.min.json`), one object per word::

    {"s": "阿姨", "l": ["t3", "n4", "o3"], "p": ["n"], "f": [...]}

`s` is the simplified form, `l` the levels it appears in (`nN` = HSK 3.0 level N,
`oN` = HSK 2.0 level N; `tN` is a third list we ignore), `p` the ICTCLAS-family
POS tags. Only `s`, level and POS are kept — glosses come from the app's own
dictionary. The dataset is MIT-licensed.
"""

from __future__ import annotations

from typing import Any

import httpx

from shougong.usecase.commons.logging import get_logger
from shougong.usecase.reading.gateway import IHskVocabularySource
from shougong.usecase.reading.proficiency import HskLevelStats
from shougong.usecase.reading.vocabulary import HskEntry, VocabularyCategory, category_for

_DATASET_URL = "https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/main/complete.min.json"
_DOWNLOAD_TIMEOUT = httpx.Timeout(60.0, connect=10.0)

_log = get_logger(__name__)


def _hsk_level(levels: list[str]) -> int | None:
    """Lowest HSK 3.0 (`nN`) level, else lowest HSK 2.0 (`oN`) level, else None."""
    new = [int(code[1:]) for code in levels if code.startswith("n") and code[1:].isdigit()]
    if new:
        return min(new)
    old = [int(code[1:]) for code in levels if code.startswith("o") and code[1:].isdigit()]
    return min(old) if old else None


def parse_dataset(entries: list[dict[str, Any]]) -> dict[str, HskEntry]:
    result: dict[str, HskEntry] = {}
    for entry in entries:
        simplified = entry.get("s")
        if not simplified or simplified in result:
            continue
        result[simplified] = HskEntry(
            hsk_level=_hsk_level(entry.get("l") or []),
            pos_tags=tuple(entry.get("p") or []),
        )
    return result


def _level_stats(dataset: dict[str, HskEntry]) -> HskLevelStats:
    total_by_level: dict[int, int] = {}
    functional_by_level: dict[int, set[str]] = {}
    for word, entry in dataset.items():
        if entry.hsk_level is None:
            continue
        total_by_level[entry.hsk_level] = total_by_level.get(entry.hsk_level, 0) + 1
        if category_for(word, entry.pos_tags) is VocabularyCategory.FUNCTIONAL:
            functional_by_level.setdefault(entry.hsk_level, set()).add(word)
    return HskLevelStats(
        total_by_level=total_by_level,
        functional_by_level={level: frozenset(words) for level, words in functional_by_level.items()},
    )


class HskVocabularySource(IHskVocabularySource):
    def __init__(self, client: httpx.AsyncClient, url: str = _DATASET_URL) -> None:
        self._client = client
        self._url = url
        self._cache: dict[str, HskEntry] | None = None
        self._level_stats_cache: HskLevelStats | None = None

    async def fetch(self) -> dict[str, HskEntry]:
        if self._cache is not None:
            return self._cache
        _log.info("hsk.download.started", url=self._url)
        response = await self._client.get(self._url, timeout=_DOWNLOAD_TIMEOUT, follow_redirects=True)
        response.raise_for_status()
        self._cache = parse_dataset(response.json())
        _log.info("hsk.download.finished", words=len(self._cache))
        return self._cache

    async def level_stats(self) -> HskLevelStats:
        if self._level_stats_cache is None:
            self._level_stats_cache = _level_stats(await self.fetch())
        return self._level_stats_cache
