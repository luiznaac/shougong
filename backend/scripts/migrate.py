"""Applies pending Alembic migrations, baselining a database that predates migrations.

Three cases:
  1. `alembic_version` already exists -> this database has been migrated before; just
     `upgrade head`.
  2. No `alembic_version`, but `dictionary_entry` exists -> a database that already has the
     schema 0001_baseline describes (production, or a local volume from before migrations
     existed). Stamp it at 0001_baseline (never running 0001's own statements against it), then
     `upgrade head` to apply everything since.
  3. Neither exists -> a genuinely empty database. `upgrade head` runs 0001 from scratch like any
     other migration.

Run via `uv run poe migrate` locally, or from `deploy/entrypoint.sh` in the container — never from
the app itself; see backend/AGENTS.md for why the app's own startup can't safely do this.
"""

from __future__ import annotations

import asyncio
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import bindparam, text
from sqlalchemy.ext.asyncio import create_async_engine

from shougong.application.settings import Settings

_BACKEND_DIR = Path(__file__).resolve().parent.parent


async def _existing_tables(url: str, names: tuple[str, ...]) -> set[str]:
    engine = create_async_engine(url)
    try:
        async with engine.connect() as conn:
            query = text(
                "SELECT table_name FROM information_schema.tables "
                "WHERE table_schema = DATABASE() AND table_name IN :names",
            ).bindparams(bindparam("names", expanding=True))
            result = await conn.execute(query, {"names": names})
            return {row[0] for row in result}
    finally:
        await engine.dispose()


def main() -> None:
    settings = Settings()
    tables = asyncio.run(_existing_tables(settings.mysql.url, ("alembic_version", "dictionary_entry")))

    config = Config(str(_BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(_BACKEND_DIR / "alembic"))

    if "alembic_version" not in tables and "dictionary_entry" in tables:
        command.stamp(config, "0001_baseline")

    command.upgrade(config, "head")


if __name__ == "__main__":
    main()
