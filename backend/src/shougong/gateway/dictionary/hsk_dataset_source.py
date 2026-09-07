"""`HskDatasetSource` — downloads the HSK word list from `complete-hsk-vocabulary`.

The upstream is a single JSON array (`complete.min.json`), one object per word::

    {"s": "阿姨", "l": ["t3", "n4", "o3"], "p": ["n"], "f": [...]}

`s` is the simplified form, `l` the levels it appears in (`nN` = HSK 3.0 level N,
`oN` = HSK 2.0 level N; `tN` is a third list we ignore), `p` the ICTCLAS-family
POS tags. Only `s`, level and POS are kept — glosses come from the app's own
dictionary. The dataset is MIT-licensed. It is fetched once, to enrich
`dictionary_entry`; nothing reads it at request time.
"""

from __future__ import annotations

from typing import Any

import httpx

from shougong.usecase.commons.logging import get_logger
from shougong.usecase.dictionary.gateway import IHskDatasetSource
from shougong.usecase.dictionary.model import HskDatasetWord

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


def parse_dataset(entries: list[dict[str, Any]]) -> dict[str, HskDatasetWord]:
    result: dict[str, HskDatasetWord] = {}
    for entry in entries:
        simplified = entry.get("s")
        if not simplified or simplified in result:
            continue
        result[simplified] = HskDatasetWord(
            simplified=simplified,
            hsk_level=_hsk_level(entry.get("l") or []),
            pos_tags=tuple(entry.get("p") or []),
        )
    return result


class HskDatasetSource(IHskDatasetSource):
    def __init__(self, client: httpx.AsyncClient, url: str = _DATASET_URL) -> None:
        self._client = client
        self._url = url
        self._cache: dict[str, HskDatasetWord] | None = None

    async def fetch(self) -> dict[str, HskDatasetWord]:
        if self._cache is not None:
            return self._cache
        _log.info("hsk.download.started", url=self._url)
        response = await self._client.get(self._url, timeout=_DOWNLOAD_TIMEOUT, follow_redirects=True)
        response.raise_for_status()
        self._cache = parse_dataset(response.json())
        _log.info("hsk.download.finished", words=len(self._cache))
        return self._cache
