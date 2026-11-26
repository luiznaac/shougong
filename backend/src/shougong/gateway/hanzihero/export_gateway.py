"""`HanziHeroExportGateway` — fetches the three simplified-course CSV exports.

HanziHero exposes each known-item list as a CSV suffix on its list route. The
requests carry the session cookie captured at login; HanziHero answers an
authenticated session with `text/plain` CSV and a stale one with a redirect to
`/users/log_in`. Redirects are not followed, so that redirect is detected and
surfaced as `HanziHeroSessionExpiredError` instead of being parsed as CSV.

All three exports are fetched before anything is imported, so a fetch failure —
expired session, transport error or an unexpected status — aborts the run.
"""

from __future__ import annotations

import httpx

from shougong.usecase.hanzihero.gateway import IHanziHeroExportGateway
from shougong.usecase.hanzihero.model import (
    HanziHeroExports,
    HanziHeroSessionExpiredError,
    HanziHeroUnavailableError,
)

_CHARACTERS_PATH = "/simplified/characters.csv"
_WORDS_PATH = "/simplified/words.csv"
_DICTIONARY_PATH = "/simplified/my-dictionary.csv"
_LOGIN_PATH = "/users/log_in"
_TIMEOUT = httpx.Timeout(30.0, connect=5.0)


class HanziHeroExportGateway(IHanziHeroExportGateway):
    def __init__(self, client: httpx.AsyncClient, base_url: str) -> None:
        self._client = client
        self._base_url = base_url.rstrip("/")

    async def fetch_exports(self, session_cookie: str) -> HanziHeroExports:
        characters = await self._fetch(_CHARACTERS_PATH, session_cookie)
        words = await self._fetch(_WORDS_PATH, session_cookie)
        dictionary = await self._fetch(_DICTIONARY_PATH, session_cookie)
        return HanziHeroExports(characters=characters, words=words, dictionary=dictionary)

    async def _fetch(self, path: str, session_cookie: str) -> str:
        try:
            response = await self._client.get(
                f"{self._base_url}{path}",
                headers={"Cookie": session_cookie},
                timeout=_TIMEOUT,
                follow_redirects=False,
            )
        except httpx.HTTPError as error:
            raise HanziHeroUnavailableError("could not reach HanziHero") from error
        if response.is_redirect and _LOGIN_PATH in response.headers.get("location", ""):
            raise HanziHeroSessionExpiredError("HanziHero session expired; reconnect required")
        if response.status_code != 200:
            raise HanziHeroUnavailableError(f"HanziHero export returned HTTP {response.status_code}")
        return response.text
