"""add hanzihero connection

Revision ID: 0010_hanzihero_connection
Revises: 0009_enrichment_level_totals
Create Date: 2026-11-26 09:31:19.077377

Adds the single-row HanziHero connection table: the authenticated session
cookie plus the connected and last-synced instants. `id` is always 1; the
connect use case upserts over it.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision: str = "0010_hanzihero_connection"
down_revision: str | Sequence[str] | None = "0009_enrichment_level_totals"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "hanzihero_connection",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("session_cookie", sa.Text(), nullable=False),
        sa.Column("connected_at", mysql.DATETIME(fsp=6), nullable=False),
        sa.Column("last_synced_at", mysql.DATETIME(fsp=6), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("hanzihero_connection")
