"""Typed configuration — `application.yaml` + `@Value` + profiles, all in one place.

Values come from environment variables (and an optional `.env`). Nested groups
use `__` as the delimiter, e.g. `MYSQL__HOST`, `GATEWAYS__APP__HOST`.
Pick the profile with `APP_ENV=dev|prod|test`: dev (the default) binds the
project's assigned host block, while any other profile keeps the canonical
8080/3306 unless the ports are set explicitly.
"""

from __future__ import annotations

import socket
from typing import Literal, Self

from pydantic import BaseModel, Field, model_validator
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
    # Unset derives from `HTTP_PORT`; an explicit host wins for container/deploy.
    host: str | None = None


class AiGatewayConfig(BaseModel):
    # Points at the self-hosted LiteLLM proxy (OpenAI-compatible), already
    # running elsewhere — this service never deploys it. Which model backs a
    # given generation is chosen per request by the caller (the reading screen
    # lists the proxy's models and sends one), never configured here.
    base_url: str = "http://localhost:4000"
    api_key: str = ""
    # Reasoning tokens count against max_output_tokens, so a reasoning model left
    # at its default effort can spend the whole budget thinking and never emit
    # the tool call. "low" is the measured sweet spot for the constrained
    # reading-text task: higher effort doubled latency without reducing
    # out-of-vocabulary words in the correction loop.
    reasoning_effort: Literal["none", "minimal", "low", "medium", "high"] = "low"
    # Ceiling, not an allocation: the response is truncated once it is reached.
    # Observed reasoning peaked near 12k, so 16k leaves headroom without paying
    # for tokens the model never generates.
    max_output_tokens: int = Field(default=16_000, ge=256)
    # One non-streaming generation call returns only after the whole text is
    # produced, which routinely outlasts a normal HTTP read timeout. This is the
    # ceiling for a single attempt; the correction loop makes several.
    generation_timeout_seconds: float = Field(default=300.0, gt=0)


class GatewaysConfig(BaseModel):
    app: AppGatewayConfig = Field(default_factory=AppGatewayConfig)
    ai: AiGatewayConfig = Field(default_factory=AiGatewayConfig)


class TelemetryConfig(BaseModel):
    """The telemetry keys, typed once from the standard env names."""

    service_name: str
    service_version: str | None
    host_name: str
    endpoint: str | None
    console: bool
    batch_schedule_delay_ms: int
    metric_export_interval_ms: int


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

    otel_service_name: str = Field(default="shougong", validation_alias="OTEL_SERVICE_NAME")
    otlp_endpoint: str | None = Field(default=None, validation_alias="OTEL_EXPORTER_OTLP_ENDPOINT")
    telemetry_console: bool = Field(default=False, validation_alias="TELEMETRY_CONSOLE")
    service_version: str | None = Field(default=None, validation_alias="SERVICE_VERSION")
    host_name: str = Field(default_factory=socket.gethostname, validation_alias="HOSTNAME")
    otel_batch_schedule_delay: int = Field(default=5000, validation_alias="OTEL_BLRP_SCHEDULE_DELAY")
    otel_metric_export_interval: int = Field(default=60000, validation_alias="OTEL_METRIC_EXPORT_INTERVAL")

    # On startup, download CC-CEDICT and fill `dictionary_entry` if it is empty.
    dictionary_autoload: bool = True

    # On startup, after the dictionary is populated, download the HSK dataset once
    # and stamp `hsk_level` + `pos_tags` onto `dictionary_entry`. Idempotent — a
    # no-op once done. Off in tests that don't want the fetch.
    hsk_enrich_autoload: bool = True

    # The HSK 3.0 word list (drkameleon/complete-hsk-vocabulary). Overridden in
    # tests to point somewhere unreachable so nothing downloads.
    hsk_dataset_url: str = "https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/main/complete.min.json"

    # IANA timezone whose midnight is the SRS "day boundary": a day's cards all
    # become due at once (local midnight) rather than through the day.
    study_timezone: str = "UTC"

    mysql: MySqlConfig = Field(default_factory=MySqlConfig)
    gateways: GatewaysConfig = Field(default_factory=GatewaysConfig)

    @model_validator(mode="after")
    def _apply_dev_port_block(self) -> Self:
        """Dev (the default profile) gets shougong's assigned host block.

        Any other environment keeps the canonical 8080/3306, so a host or deploy
        process that does not set the ports still reaches its local MySQL. An
        explicit value always wins.
        """
        if self.app_env != "dev":
            return self
        if "http_port" not in self.model_fields_set:
            self.http_port = 8130
        if "port" not in self.mysql.model_fields_set:
            self.mysql.port = 8132
        return self

    @property
    def is_dev(self) -> bool:
        return self.app_env == "dev"

    @property
    def log_as_json(self) -> bool:
        return not self.is_dev

    @property
    def app_host(self) -> str:
        return self.gateways.app.host or f"http://localhost:{self.http_port}"

    @property
    def telemetry(self) -> TelemetryConfig:
        endpoint = self.otlp_endpoint
        if endpoint is None and self.app_env != "prod":
            endpoint = "http://localhost:4318"
        return TelemetryConfig(
            service_name=self.otel_service_name,
            service_version=self.service_version,
            host_name=self.host_name,
            endpoint=endpoint,
            console=self.telemetry_console,
            batch_schedule_delay_ms=self.otel_batch_schedule_delay,
            metric_export_interval_ms=self.otel_metric_export_interval,
        )
