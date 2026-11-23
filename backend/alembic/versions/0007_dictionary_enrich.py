"""dictionary enrichment version

Revision ID: 0007_dictionary_enrich
Revises: 0006_merge_priority_insights
Create Date: 2026-11-23 18:30:00.000000

Adds the single-row marker recording which enrichment version last stamped
`dictionary_entry`. The pass upserts `id = 1`; the row is absent until the pass
first runs, so an existing database re-runs it once in place.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0007_dictionary_enrich"
down_revision: str | Sequence[str] | None = "0006_merge_priority_insights"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "dictionary_enrichment_state",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("dictionary_enrichment_state")
