"""`HskDatasetSource` — downloads the community POS tags from `complete-hsk-vocabulary`.

The upstream is a single JSON array (`complete.min.json`), one object per word::

    {"s": "阿姨", "l": ["t3", "n4", "o3"], "p": ["n"], "f": [...]}

`s` is the simplified form and `p` the ICTCLAS-family POS tags; the `l` levels
are ignored — the vocabulary level comes from the official HSK 3.0 list
(`official_hsk_source`), and this community dataset is the POS source the reading
engine samples PERSON and PLACE words from. Glosses come from the app's own
dictionary. The dataset is MIT-licensed. It is fetched once, to enrich
`dictionary_entry`; nothing reads it at request time.
"""

from __future__ import annotations

from typing import Any

import httpx

from shougong.usecase.dictionary.gateway import CommunityPosTags, IHskDatasetSource

_DATASET_URL = "https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/main/complete.min.json"
_DOWNLOAD_TIMEOUT = httpx.Timeout(60.0, connect=10.0)


def parse_pos_tags(entries: list[dict[str, Any]]) -> CommunityPosTags:
    result: CommunityPosTags = {}
    for entry in entries:
        simplified = entry.get("s")
        if not simplified or simplified in result:
            continue
        result[simplified] = tuple(entry.get("p") or [])
    return result


class HskDatasetSource(IHskDatasetSource):
    def __init__(self, client: httpx.AsyncClient, url: str = _DATASET_URL) -> None:
        self._client = client
        self._url = url
        self._cache: CommunityPosTags | None = None

    async def fetch(self) -> CommunityPosTags:
        if self._cache is not None:
            return self._cache
        response = await self._client.get(self._url, timeout=_DOWNLOAD_TIMEOUT, follow_redirects=True)
        response.raise_for_status()
        self._cache = parse_pos_tags(response.json())
        return self._cache
