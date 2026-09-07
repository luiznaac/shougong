"""Integration harness — the `integrationTest` module equivalent.

Spins up a real MySQL via Testcontainers (needs a Docker daemon) and boots the
actual FastAPI app in-process, driven over ASGI by httpx. External HTTP is
faked per-test with `pytest-httpserver`.
"""

from __future__ import annotations

from collections.abc import AsyncIterator, Iterator

import httpx
import pytest
from testcontainers.mysql import MySqlContainer

from shougong.application.container import Container
from shougong.application.settings import MySqlConfig, Settings


def pytest_collection_modifyitems(items: list[pytest.Item]) -> None:
    for item in items:
        item.add_marker("integration")


@pytest.fixture(scope="session")
def mysql() -> Iterator[MySqlContainer]:
    with MySqlContainer("mysql:8.4") as container:
        yield container


@pytest.fixture
def settings(mysql: MySqlContainer) -> Settings:
    return Settings(
        app_env="test",
        # nothing reachable — the HSK dataset never downloads in tests
        hsk_dataset_url="http://localhost:1/hsk.json",
        mysql=MySqlConfig(
            host=mysql.get_container_host_ip(),
            port=int(mysql.get_exposed_port(3306)),
            user=mysql.username,
            password=mysql.password,
            database=mysql.dbname,
        ),
    )


@pytest.fixture
async def container(settings: Settings) -> AsyncIterator[Container]:
    instance = Container(settings)
    try:
        yield instance
    finally:
        await instance.aclose()


@pytest.fixture(autouse=True)
async def _schema(container: Container) -> None:
    # Building the Container imports every repository (and hence every entity
    # module), so Base.metadata is fully populated by the time we get here.
    # init.sql isn't run by testcontainers, so rebuild the schema per test.
    from shougong.persistence.configuration.base import Base

    async with container.engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)


@pytest.fixture
async def client(container: Container) -> AsyncIterator[httpx.AsyncClient]:
    transport = httpx.ASGITransport(app=container.app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as http_client:
        yield http_client
