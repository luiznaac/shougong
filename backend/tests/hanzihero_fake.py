"""A fake HanziHero login page and responders shared by the unit and integration suites."""

from __future__ import annotations

from werkzeug.wrappers import Request, Response

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
