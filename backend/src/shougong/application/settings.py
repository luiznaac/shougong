"""Typed configuration — `application.yaml` + `@Value` + profiles, all in one place.

Values come from environment variables (and an optional `.env`). Nested groups
use `__` as the delimiter, e.g. `MYSQL__HOST`, `GATEWAYS__APP__HOST`.
Pick the profile with `APP_ENV=dev|prod|test`.
"""

from __future__ import annotations

from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class MySqlConfig(BaseModel):
    host: str = "localhost"
    port: int = 3306
    user: str = "root"
    password: str = ""
    database: str = "shougong"

    @property
    def url(self) -> str:
        return f"mysql+asyncmy://{self.user}:{self.password}@{self.host}:{self.port}/{self.database}"


class AppGatewayConfig(BaseModel):
    # Base URL the service uses to call its own /health/internal (see AppHealthGateway).
    host: str = "http://localhost:8080"


class AiGatewayConfig(BaseModel):
    # Points at the self-hosted LiteLLM proxy (OpenAI-compatible), already
    # running elsewhere — this service never deploys it. No default `model`:
    # which model actually backs this deliberately isn't baked into the repo.
    base_url: str = "http://localhost:4000"
    api_key: str = ""
    model: str = ""


class GatewaysConfig(BaseModel):
    app: AppGatewayConfig = Field(default_factory=AppGatewayConfig)
    ai: AiGatewayConfig = Field(default_factory=AiGatewayConfig)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_nested_delimiter="__",
        extra="ignore",
    )

    app_env: str = "dev"
    http_port: int = 8080
    log_level: str = "INFO"

    # On startup, download CC-CEDICT and fill `dictionary_entry` if it is empty.
    dictionary_autoload: bool = True

    # IANA timezone whose midnight is the SRS "day boundary": a day's cards all
    # become due at once (local midnight) rather than through the day.
    study_timezone: str = "UTC"

    mysql: MySqlConfig = Field(default_factory=MySqlConfig)
    gateways: GatewaysConfig = Field(default_factory=GatewaysConfig)

    @property
    def log_as_json(self) -> bool:
        return self.app_env != "dev"
