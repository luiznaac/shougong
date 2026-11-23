"""character writing levels and the derived word handwriting level

Revision ID: 0008_handwriting_levels
Revises: 0007_dictionary_enrich
Create Date: 2026-11-23 19:10:00.000000

Adds the character-level writing store (`character_writing_level`) and the
derived `dictionary_entry.handwriting_level` column. The versioned enrichment
pass fills both in place when its version advances.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0008_handwriting_levels"
down_revision: str | Sequence[str] | None = "0007_dictionary_enrich"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "character_writing_level",
        sa.Column("character", sa.String(length=8), nullable=False),
        sa.Column("writing_level", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("character"),
    )
    op.add_column("dictionary_entry", sa.Column("handwriting_level", sa.Integer(), nullable=True))
    op.create_index(
        "ix_dictionary_entry_handwriting_level",
        "dictionary_entry",
        ["handwriting_level"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_dictionary_entry_handwriting_level", table_name="dictionary_entry")
    op.drop_column("dictionary_entry", "handwriting_level")
    op.drop_table("character_writing_level")
