"""`CedictSource` — downloads and parses CC-CEDICT from MDBG.

The upstream file is a gzip of the standard CC-CEDICT text format::

    Traditional Simplified [pin1 yin1] /gloss one/gloss two/

Traditional forms are dropped — this trainer only drills simplified handwriting.
Pinyin is normalised on the way in (see `sanitize_pinyin`): lower-cased, with ü
written as ``v`` instead of the CC-CEDICT ``u:`` digraph.
CC-CEDICT is licensed CC BY-SA 4.0.
"""

from __future__ import annotations

import gzip
import re

import httpx

from shougong.usecase.commons.logging import get_logger
from shougong.usecase.dictionary.gateway import ICedictSource
from shougong.usecase.dictionary.model import CedictRecord
from shougong.usecase.dictionary.pinyin import sanitize_pinyin

_MDBG_URL = "https://www.mdbg.net/chinese/export/cedict/cedict_1_0_ts_utf-8_mdbg.txt.gz"
_LINE_RE = re.compile(r"^\S+\s+(?P<simplified>\S+)\s+\[(?P<pinyin>[^\]]*)]\s+/(?P<defs>.+)/\s*$")
_DOWNLOAD_TIMEOUT = httpx.Timeout(120.0, connect=10.0)

_log = get_logger(__name__)


def parse_cedict(text: str) -> list[CedictRecord]:
    records: list[CedictRecord] = []
    for line in text.splitlines():
        if not line or line.startswith("#"):
            continue
        match = _LINE_RE.match(line)
        if match is None:
            continue
        records.append(
            CedictRecord(
                simplified=match["simplified"],
                pinyin=sanitize_pinyin(match["pinyin"]),
                definitions=tuple(match["defs"].split("/")),
            )
        )
    return records


class CedictSource(ICedictSource):
    def __init__(self, client: httpx.AsyncClient, url: str = _MDBG_URL) -> None:
        self._client = client
        self._url = url

    async def fetch(self) -> list[CedictRecord]:
        _log.info("cedict.download.started", url=self._url)
        response = await self._client.get(self._url, timeout=_DOWNLOAD_TIMEOUT, follow_redirects=True)
        response.raise_for_status()
        text = gzip.decompress(response.content).decode("utf-8")
        records = parse_cedict(text)
        _log.info("cedict.download.finished", records=len(records))
        return records
