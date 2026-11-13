"""The `/api` proxy must outlast the reading correction loop.

A generation attempt is a slow, non-streaming reasoning call (live requests ran
86-246s at the default effort) and the frontend allows up to 6 attempts, so
nginx's default 60s `proxy_read_timeout` would cut the connection while the app
keeps generating. Keep the proxy ceiling above the app's worst case.
"""

from pathlib import Path

from shougong.application.settings import AiGatewayConfig

_TEMPLATE = Path(__file__).resolve().parents[3] / "deploy" / "nginx.conf.template"
_MAX_ATTEMPTS = 6  # frontend ATTEMPTS_BOUNDS.max (ReadingGenerator.tsx)


def _timeout_seconds(directive: str) -> float:
    for line in _TEMPLATE.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if stripped.startswith(f"{directive} "):
            return float(stripped.removeprefix(directive).strip().removesuffix(";").removesuffix("s"))
    raise AssertionError(f"{directive} is not set in {_TEMPLATE}")


def test_api_proxy_outlasts_the_reading_correction_loop() -> None:
    worst_case = AiGatewayConfig().generation_timeout_seconds * _MAX_ATTEMPTS
    assert _timeout_seconds("proxy_read_timeout") >= worst_case
    assert _timeout_seconds("proxy_send_timeout") >= worst_case
