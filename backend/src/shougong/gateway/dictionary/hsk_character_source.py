"""`HskCharacterSource` — downloads the official HSK 3.0 handwriting character list.

The upstream (`ivankra/hsk30`, MIT) is a CSV with one character per row::

    Hanzi,Level,WritingLevel,Traditional,Freq,Examples
    班,1,2,班,14,班 上班

`Level` is the recognition level, `WritingLevel` the level at which the character
is expected to be written. The handwriting list covers only the characters that
have a writing requirement, so rows with an empty `WritingLevel` are skipped.
Levels are normalised to 1-6 plus the single 7-9 band (stored as 7). The dataset
is fetched once, to fill the character-level store; nothing reads it at request
time.
"""

from __future__ import annotations

import csv
import io

import httpx

from shougong.usecase.dictionary.gateway import IHskCharacterSource
from shougong.usecase.dictionary.model import HskCharacter

_DATASET_URL = "https://raw.githubusercontent.com/ivankra/hsk30/master/hsk30-chars.csv"
_DOWNLOAD_TIMEOUT = httpx.Timeout(60.0, connect=10.0)


def _writing_level(raw: str) -> int | None:
    """A writing level normalised to 1-6, the 7-9 band as 7, or None when absent."""
    value = raw.strip()
    if not value:
        return None
    if value == "7-9":
        return 7
    if value.isdigit():
        level = int(value)
        if 1 <= level <= 6:
            return level
        if 7 <= level <= 9:
            return 7
    return None


def parse_characters(text: str) -> dict[str, HskCharacter]:
    result: dict[str, HskCharacter] = {}
    for row in csv.DictReader(io.StringIO(text)):
        character = (row.get("Hanzi") or "").strip()
        if not character or character in result:
            continue
        writing_level = _writing_level(row.get("WritingLevel") or "")
        if writing_level is None:
            continue
        result[character] = HskCharacter(character=character, writing_level=writing_level)
    return result


class HskCharacterSource(IHskCharacterSource):
    def __init__(self, client: httpx.AsyncClient, url: str = _DATASET_URL) -> None:
        self._client = client
        self._url = url
        self._cache: dict[str, HskCharacter] | None = None

    async def fetch(self) -> dict[str, HskCharacter]:
        if self._cache is not None:
            return self._cache
        response = await self._client.get(self._url, timeout=_DOWNLOAD_TIMEOUT, follow_redirects=True)
        response.raise_for_status()
        self._cache = parse_characters(response.text)
        return self._cache
