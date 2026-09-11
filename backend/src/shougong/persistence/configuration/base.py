"""Declarative base for ORM entities.

Add a new entity here, then write the migration for it (`uv run poe migrate:generate` — see
backend/AGENTS.md) and register its module in `alembic/env.py` so `Base.metadata` picks it
up for autogenerate.
"""

from __future__ import annotations

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
