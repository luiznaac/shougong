"""`HanziWriterSource` — fetches one character's stroke data from hanzi-writer-data.

hanzi-writer-data packages the open "Make Me a Hanzi" stroke dataset as one JSON
file per character, published on npm and served by jsdelivr. Each file has the
shape `{ strokes: [d, ...], medians: [[[x, y], ...], ...] }`, one entry per stroke
in drawing order. Licensed under Arphic Public License / CC-BY-SA per the
upstream project.
"""

from __future__ import annotations

from urllib.parse import quote

import httpx

from shougong.usecase.commons.logging import get_logger
from shougong.usecase.strokes.gateway import IHanziStrokeSource
from shougong.usecase.strokes.model import CharacterStrokes

_JSDELIVR_URL_TEMPLATE = "https://cdn.jsdelivr.net/npm/hanzi-writer-data@2/{character}.json"
_FETCH_TIMEOUT = httpx.Timeout(10.0, connect=5.0)

_log = get_logger(__name__)


class HanziWriterSource(IHanziStrokeSource):
    def __init__(self, client: httpx.AsyncClient, url_template: str = _JSDELIVR_URL_TEMPLATE) -> None:
        self._client = client
        self._url_template = url_template

    async def fetch(self, character: str) -> CharacterStrokes | None:
        url = self._url_template.format(character=quote(character, safe=""))
        _log.info("strokes.fetch.started", character=character)
        response = await self._client.get(url, timeout=_FETCH_TIMEOUT, follow_redirects=True)
        if response.status_code == 404:
            return None
        response.raise_for_status()
        body = response.json()
        return CharacterStrokes(
            character=character,
            strokes=tuple(body["strokes"]),
            medians=tuple(tuple((pt[0], pt[1]) for pt in stroke) for stroke in body["medians"]),
        )
