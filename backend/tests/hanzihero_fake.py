"""A fake HanziHero login page and responders shared by the unit and integration suites."""

from __future__ import annotations

from collections.abc import Callable

from werkzeug.wrappers import Request, Response

CHARACTERS_HEADER = (
    "character,pinyin,meaning,srs_stage,numbered_pinyin,alternate_meanings,user_synonyms,user_notes,skipped\n"
)
WORDS_HEADER = "word,pinyin,meaning,srs_stage,numbered_pinyin,alternate_meanings,user_synonyms,user_notes,skipped\n"
DICTIONARY_HEADER = (
    "entry,pinyin,primary_definition,srs_stage,numbered_pinyin,definitions,user_definitions,user_notes,skipped\n"
)

LOGIN_PAGE = """<!DOCTYPE html>
<html>
  <body>
    <form action="/users/log_in" method="post" id="login_form">
      <input name="_csrf_token" type="hidden" hidden value="csrf-token-123">
      <input type="text" name="user[email_username]" id="login_form_email_username">
      <input type="password" name="user[password]" id="login_form_password">
      <input type="hidden" name="user[remember_me]" value="false">
      <input type="checkbox" name="user[remember_me]" value="true">
    </form>
  </body>
</html>
"""


def login_page(_: Request) -> Response:
    return Response(
        LOGIN_PAGE,
        content_type="text/html",
        headers={"Set-Cookie": "_hanzi_hero_key=pre-login; path=/; HttpOnly"},
    )


def accept_login(_: Request) -> Response:
    return Response(
        "",
        status=302,
        headers={"Location": "/", "Set-Cookie": "_hanzi_hero_key=authenticated; path=/; HttpOnly"},
    )


def reject_login(_: Request) -> Response:
    return Response(LOGIN_PAGE, content_type="text/html")


def csv_response(body: str) -> Callable[[Request], Response]:
    """An export responder serving `body` as CSV text."""

    def handler(_: Request) -> Response:
        return Response(body, content_type="text/plain; charset=utf-8")

    return handler


def redirect_to_login(_: Request) -> Response:
    """A stale session's answer: a redirect to the login page."""
    return Response("", status=303, headers={"Location": "/users/log_in"})
