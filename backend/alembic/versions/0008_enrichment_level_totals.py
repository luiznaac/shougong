"""dictionary official level totals

Revision ID: 0008_enrichment_level_totals
Revises: 0007_dictionary_enrich
Create Date: 2026-11-23 19:00:00.000000

Records the official HSK 3.0 word counts per level on the single enrichment
marker, so proficiency and coverage divide by the official list's totals rather
than by the dictionary subset. NULL until the pass next runs (a version bump
re-enriches and fills it).
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0008_enrichment_level_totals"
down_revision: str | Sequence[str] | None = "0007_dictionary_enrich"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("dictionary_enrichment_state", sa.Column("level_totals", sa.JSON(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("dictionary_enrichment_state", "level_totals")
