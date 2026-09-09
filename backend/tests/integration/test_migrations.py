"""The guard that keeps alembic/versions/ and the SQLAlchemy entities from drifting apart — the
failure mode that made `mysql/init.sql` unmaintainable (see backend/CLAUDE.md §3.5). Migrates a
throwaway MySQL to head, then asks Alembic's own autogenerate machinery what would still have to
change for it to match `Base.metadata`. Anything non-empty means an entity changed without a
matching migration, or vice versa.

A plain (non-async) test: `alembic.command.upgrade` runs its own `asyncio.run()` internally (see
alembic/env.py), which cannot happen from inside a running event loop.
"""

from __future__ import annotations

import asyncio
import os
from pathlib import Path

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from sqlalchemy.ext.asyncio import create_async_engine
from testcontainers.mysql import MySqlContainer

from shougong.persistence.configuration.base import Base

# Populates Base.metadata as a side effect of import, same as alembic/env.py.
from shougong.persistence.dictionary.entity import DictionaryEntryEntity  # noqa: F401
from shougong.persistence.reading.entity import ReadingTextEntity  # noqa: F401
from shougong.persistence.reading.topic_entity import ReadingTopicEntity  # noqa: F401
from shougong.persistence.reading.word_usage_entity import ReadingWordUsageEntity  # noqa: F401
from shougong.persistence.strokes.entity import CharacterStrokesEntity  # noqa: F401
from shougong.persistence.study.entity import ReviewLogEntity, StudyItemEntity  # noqa: F401
from shougong.persistence.study_item_history.entity import StudyItemHistoryEntity  # noqa: F401

_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent


async def _pending_diff(url: str) -> list[object]:
    engine = create_async_engine(url)
    try:
        async with engine.connect() as conn:

            def _compare(sync_conn: object) -> list[object]:
                context = MigrationContext.configure(sync_conn)
                return list(compare_metadata(context, Base.metadata))

            return await conn.run_sync(_compare)
    finally:
        await engine.dispose()


@pytest.mark.integration
def test_migrations_produce_exactly_the_schema_the_entities_declare() -> None:
    with MySqlContainer("mysql:8.4") as mysql:
        env = {
            "MYSQL__HOST": mysql.get_container_host_ip(),
            "MYSQL__PORT": str(mysql.get_exposed_port(3306)),
            "MYSQL__USER": mysql.username,
            "MYSQL__PASSWORD": mysql.password,
            "MYSQL__DATABASE": mysql.dbname,
        }
        previous = {key: os.environ.get(key) for key in env}
        os.environ.update(env)
        try:
            config = Config(str(_BACKEND_DIR / "alembic.ini"))
            config.set_main_option("script_location", str(_BACKEND_DIR / "alembic"))
            command.upgrade(config, "head")

            url = f"mysql+asyncmy://{mysql.username}:{mysql.password}@{mysql.get_container_host_ip()}:{mysql.get_exposed_port(3306)}/{mysql.dbname}"
            assert asyncio.run(_pending_diff(url)) == []
        finally:
            for key, value in previous.items():
                if value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = value
