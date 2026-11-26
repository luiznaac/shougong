"""`HanziHeroLoginGateway` — performs HanziHero's Phoenix cookie login server-side.

HanziHero has no API and no OAuth; the only session it issues is the `HttpOnly`
cookie a browser gets after posting the login form. The handshake is three steps:
fetch `/users/log_in` to read the CSRF token and the pre-login session cookie,
post the form (CSRF token, email/username, password, remember-me) with that
cookie, and keep the session cookie the successful response sets. The password
and email/username are sent upstream once and never logged, stored or returned.

The gateway owns its own HTTP client by default: the login handshake needs a
cookie jar scoped to this one flow, and a stale session cookie living on the
shared client's jar would make the login page redirect instead of render.
"""

from __future__ import annotations

from html.parser import HTMLParser

import httpx

from shougong.gateway.configuration.http_client import build_http_client
from shougong.usecase.hanzihero.gateway import IHanziHeroLoginGateway
from shougong.usecase.hanzihero.model import (
    HanziHeroAuthenticationError,
    HanziHeroUnavailableError,
)

_LOGIN_PATH = "/users/log_in"
_TIMEOUT = httpx.Timeout(10.0, connect=5.0)


class _CsrfTokenParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.token: str | None = None

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "input":
            return
        attributes = dict(attrs)
        if attributes.get("name") == "_csrf_token":
            self.token = attributes.get("value")


def _extract_csrf_token(html: str) -> str | None:
    parser = _CsrfTokenParser()
    parser.feed(html)
    return parser.token


def _looks_like_login_form(html: str) -> bool:
    return 'id="login_form"' in html or 'name="_csrf_token"' in html


def _cookie_header(cookies: httpx.Cookies) -> str:
    return "; ".join(f"{name}={value}" for name, value in cookies.items())


class HanziHeroLoginGateway(IHanziHeroLoginGateway):
    def __init__(self, base_url: str, *, client: httpx.AsyncClient | None = None) -> None:
        self._login_url = f"{base_url.rstrip('/')}{_LOGIN_PATH}"
        self._client = client if client is not None else build_http_client()
        self._owns_client = client is None

    async def aclose(self) -> None:
        """Close the client only when this gateway built it."""
        if self._owns_client:
            await self._client.aclose()

    async def log_in(self, identifier: str, password: str) -> str:
        # Start with an empty jar so a previous authenticated cookie cannot make
        # the login page redirect to the dashboard instead of serving the form.
        self._client.cookies.clear()
        page = await self._fetch_login_page()
        csrf_token = _extract_csrf_token(page.text)
        if csrf_token is None:
            raise HanziHeroUnavailableError("HanziHero login page did not include a CSRF token")

        response = await self._post_credentials(csrf_token, identifier, password)
        if response.is_redirect:
            if _LOGIN_PATH in response.headers.get("location", ""):
                raise HanziHeroAuthenticationError("HanziHero rejected the email/username or password")
            return self._session_cookie(response)
        if response.status_code == 200 and _looks_like_login_form(response.text):
            raise HanziHeroAuthenticationError("HanziHero rejected the email/username or password")
        raise HanziHeroUnavailableError(f"HanziHero login returned HTTP {response.status_code}")

    async def _fetch_login_page(self) -> httpx.Response:
        try:
            page = await self._client.get(self._login_url, timeout=_TIMEOUT)
        except httpx.HTTPError as error:
            raise HanziHeroUnavailableError("could not reach HanziHero") from error
        if page.status_code != 200:
            raise HanziHeroUnavailableError(f"HanziHero login page returned HTTP {page.status_code}")
        return page

    async def _post_credentials(
        self,
        csrf_token: str,
        identifier: str,
        password: str,
    ) -> httpx.Response:
        form = {
            "_csrf_token": csrf_token,
            "user[email_username]": identifier,
            "user[password]": password,
            "user[remember_me]": "true",
        }
        try:
            return await self._client.post(
                self._login_url,
                data=form,
                timeout=_TIMEOUT,
                follow_redirects=False,
            )
        except httpx.HTTPError as error:
            raise HanziHeroUnavailableError("could not reach HanziHero") from error

    def _session_cookie(self, response: httpx.Response) -> str:
        # Only the cookie(s) the successful login response sets — the authenticated
        # session. The pre-login cookie from the GET page is not persisted.
        header = _cookie_header(response.cookies)
        if not header:
            raise HanziHeroUnavailableError("HanziHero login did not return a session cookie")
        return header
