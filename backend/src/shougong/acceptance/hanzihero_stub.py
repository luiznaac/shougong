"""A dev-only HanziHero host for the acceptance browser run.

HanziHero has no API, so the connect flow performs its Phoenix cookie login
against whatever `HANZIHERO__BASE_URL` points at. The acceptance runbook points
it here: this stub serves the login page (CSRF token plus pre-login cookie) and
accepts exactly one fixture credential pair, redirecting with an authenticated
session cookie. Every other pair is answered with the login page again, so a
rejected login is driveable too. Its three export routes answer with the login
redirect (a stale stored session), so a sync run drives the "session expired"
reconnect path.

It is a fixture, not a product surface: like the rest of the acceptance package
it is excluded from the production image (`.dockerignore`), and its contract is
pinned through the real login gateway in `tests/unit/test_hanzihero_stub.py`.
The login page and cookie shapes are exported so the test suite's own HanziHero
fake serves the same Phoenix markup instead of a drifting copy.
"""

from __future__ import annotations

import argparse
import contextlib
import http.server
import urllib.parse
from collections.abc import Sequence

from shougong.usecase.commons.logging import get_logger

_log = get_logger(__name__)

# The acceptance fixture credentials, documented in docs/runbooks/acceptance.md.
# Not a secret: the stub is dev-only and never reachable in production.
ACCEPTED_IDENTIFIER = "dev-hanzihero-learner@example.com"
ACCEPTED_PASSWORD = "dev-hanzihero-password"

CSRF_TOKEN = "acceptance-csrf-token"
PRE_LOGIN_COOKIE = "_hanzi_hero_key=pre-login; Path=/; HttpOnly"
SESSION_COOKIE = "_hanzi_hero_key=authenticated; Path=/; HttpOnly"
_LOGIN_PATH = "/users/log_in"

# The three exports the sync fetches. The stub answers each with the login
# redirect instead of CSV: that is HanziHero's "stored session is stale" shape,
# which `HanziHeroExportGateway` surfaces as `HanziHeroSessionExpiredError`. It
# lets the acceptance run drive the sync-triggered "session expired" notice
# without a real account or network.
_EXPORT_PATHS = frozenset({"/simplified/characters.csv", "/simplified/words.csv", "/simplified/my-dictionary.csv"})

LOGIN_PAGE = f"""<!DOCTYPE html>
<html>
  <body>
    <form action="{_LOGIN_PATH}" method="post" id="login_form">
      <input name="_csrf_token" type="hidden" hidden value="{CSRF_TOKEN}">
      <input type="text" name="user[email_username]" id="login_form_email_username">
      <input type="password" name="user[password]" id="login_form_password">
      <input type="hidden" name="user[remember_me]" value="false">
      <input type="checkbox" name="user[remember_me]" value="true">
    </form>
  </body>
</html>
"""


def _is_accepted(form: dict[str, list[str]]) -> bool:
    return (
        form.get("_csrf_token") == [CSRF_TOKEN]
        and form.get("user[email_username]") == [ACCEPTED_IDENTIFIER]
        and form.get("user[password]") == [ACCEPTED_PASSWORD]
    )


class _HanziHeroStubHandler(http.server.BaseHTTPRequestHandler):
    """Serve the login page and accept the one fixture credential pair."""

    protocol_version = "HTTP/1.1"
    server_version = "HanziHeroStub/1.0"

    def do_GET(self) -> None:
        if self.path == _LOGIN_PATH:
            self._respond(200, LOGIN_PAGE, headers={"Set-Cookie": PRE_LOGIN_COOKIE})
            return
        if self.path in _EXPORT_PATHS:
            self._respond(302, "", headers={"Location": _LOGIN_PATH})
            return
        self._respond(404, "not found")

    def do_POST(self) -> None:
        if self.path != _LOGIN_PATH:
            self._respond(404, "not found")
            return
        form = urllib.parse.parse_qs(self._read_body())
        if _is_accepted(form):
            self._respond(302, "", headers={"Location": "/", "Set-Cookie": SESSION_COOKIE})
            return
        self._respond(200, LOGIN_PAGE)

    def _read_body(self) -> str:
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        return self.rfile.read(length).decode("utf-8")

    def _respond(self, status: int, body: str, *, headers: dict[str, str] | None = None) -> None:
        payload = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        for name, value in (headers or {}).items():
            self.send_header(name, value)
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, fmt: str, *args: object) -> None:
        # Silence the stdlib per-request access log; the stub is a fixture.
        return


def build_server(host: str, port: int) -> http.server.ThreadingHTTPServer:
    """Build the stub's HTTP server; `port` 0 asks the OS for a free port."""
    return http.server.ThreadingHTTPServer((host, port), _HanziHeroStubHandler)


def main(argv: Sequence[str] | None = None) -> None:
    """Serve the stub until interrupted; defaults to the runbook's 127.0.0.1:8134."""
    parser = argparse.ArgumentParser(description="Dev-only fake HanziHero host for the acceptance run.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8134)
    args = parser.parse_args(argv)
    server = build_server(args.host, args.port)
    _log.info("acceptance.hanzihero_stub_started", host=args.host, port=args.port)
    try:
        with contextlib.suppress(KeyboardInterrupt):
            server.serve_forever()
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
