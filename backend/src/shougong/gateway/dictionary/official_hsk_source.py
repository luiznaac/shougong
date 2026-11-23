"""`OfficialHskSource` — downloads the official HSK 3.0 word list (`ivankra/hsk30`).

The upstream is `hsk30.csv`, one row per word with its level in the `Level`
column: `1`-`6`, or the single `7-9` band (stored as level 7). A `Simplified`
cell can carry several pipe-separated forms (`爸爸|爸`), each listed at that
row's level. A word listed more than once keeps its lowest level — the level it
is introduced at. This is the vocabulary-level source; the community dataset
(`complete-hsk-vocabulary`) stays the POS source. MIT-licensed, fetched once to
enrich `dictionary_entry`; nothing reads it at request time.
"""

from __future__ import annotations

import csv
import io
import re

import httpx

from shougong.usecase.dictionary.gateway import IOfficialHskSource, OfficialLevels

_DATASET_URL = "https://raw.githubusercontent.com/ivankra/hsk30/master/hsk30.csv"
_DOWNLOAD_TIMEOUT = httpx.Timeout(60.0, connect=10.0)
# The standard keeps levels 7-9 as one band; it is stored as level 7.
_SEVEN_TO_NINE = "7-9"
# The list marks usage patterns in the word cell: a fullwidth-parenthetical
# example, a leading/trailing ellipsis, or a sense digit (`称1`). The headword is
# what maps to a dictionary entry.
_PARENTHETICAL = re.compile("\uff08[^\uff09]*\uff09")
_TRAILING_DIGITS = re.compile(r"\d+$")
_ELLIPSIS = "\u2026"


def _level(code: str) -> int:
    return 7 if code.strip() == _SEVEN_TO_NINE else int(code)


def _form(raw: str) -> str:
    return _TRAILING_DIGITS.sub("", _PARENTHETICAL.sub("", raw).replace(_ELLIPSIS, "").strip())


def parse_official_words(text: str) -> OfficialLevels:
    """Every listed word → its lowest official vocabulary level (1-6, or 7)."""
    words: OfficialLevels = {}
    for row in csv.DictReader(io.StringIO(text)):
        level = _level(row["Level"])
        for raw in row["Simplified"].split("|"):
            word = _form(raw)
            if not word:
                continue
            current = words.get(word)
            if current is None or level < current:
                words[word] = level
    return words


class OfficialHskSource(IOfficialHskSource):
    def __init__(self, client: httpx.AsyncClient, url: str = _DATASET_URL) -> None:
        self._client = client
        self._url = url
        self._cache: OfficialLevels | None = None

    async def fetch(self) -> OfficialLevels:
        if self._cache is not None:
            return self._cache
        response = await self._client.get(self._url, timeout=_DOWNLOAD_TIMEOUT, follow_redirects=True)
        response.raise_for_status()
        self._cache = parse_official_words(response.content.decode("utf-8"))
        return self._cache
