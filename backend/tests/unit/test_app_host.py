"""The self-health base URL derives from the configured HTTP port unless a host is set."""

from __future__ import annotations

from shougong.application import container as container_module
from shougong.application import settings as settings_module


def test_settings_default_to_the_assigned_dev_ports(monkeypatch) -> None:
    monkeypatch.delenv("HTTP_PORT", raising=False)
    monkeypatch.delenv("MYSQL__PORT", raising=False)

    settings = settings_module.Settings(_env_file=None)

    assert settings.http_port == 8130
    assert settings.mysql.port == 8132


def test_non_dev_env_keeps_the_canonical_ports(monkeypatch) -> None:
    monkeypatch.delenv("HTTP_PORT", raising=False)
    monkeypatch.delenv("MYSQL__PORT", raising=False)
    monkeypatch.delenv("GATEWAYS__APP__HOST", raising=False)

    settings = settings_module.Settings(_env_file=None, app_env="prod")

    assert settings.http_port == 8080
    assert settings.mysql.port == 3306
    assert settings.app_host == "http://localhost:8080"


def test_explicit_ports_win_in_a_non_dev_env(monkeypatch) -> None:
    monkeypatch.setenv("HTTP_PORT", "9200")
    monkeypatch.setenv("MYSQL__PORT", "9201")

    settings = settings_module.Settings(_env_file=None, app_env="prod")

    assert settings.http_port == 9200
    assert settings.mysql.port == 9201


def test_app_host_derives_from_the_configured_http_port(monkeypatch) -> None:
    monkeypatch.delenv("GATEWAYS__APP__HOST", raising=False)

    settings = settings_module.Settings(_env_file=None, http_port=9101)

    assert settings.app_host == "http://localhost:9101"


def test_an_explicit_gateway_host_still_wins(monkeypatch) -> None:
    monkeypatch.setenv("GATEWAYS__APP__HOST", "http://api.internal:8080")

    settings = settings_module.Settings(_env_file=None, http_port=9101)

    assert settings.app_host == "http://api.internal:8080"


async def test_container_builds_the_self_health_gateway_from_the_derived_host(monkeypatch) -> None:
    captured: list[str] = []

    class _RecordingGateway:
        def __init__(self, _client: object, base_url: str) -> None:
            captured.append(base_url)

        async def is_healthy(self) -> bool:
            return True

    monkeypatch.delenv("GATEWAYS__APP__HOST", raising=False)
    monkeypatch.setattr(container_module, "AppHealthGateway", _RecordingGateway)
    settings = settings_module.Settings(_env_file=None, http_port=9102)

    instance = container_module.Container(settings)
    try:
        assert captured == ["http://localhost:9102"]
    finally:
        await instance.aclose()
