"""dictionary hsk

Revision ID: 0002_dictionary_hsk
Revises: 0001_baseline
Create Date: 2026-09-09 12:51:33.916222

Adds HSK level + part-of-speech tags to dictionary_entry (DictionaryService.enrich_hsk). This is
literally the ALTER TABLE backend/README.md previously documented as a manual step for existing
databases — now a real, automatically-applied migration instead.
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0002_dictionary_hsk"
down_revision: str | Sequence[str] | None = "0001_baseline"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("""
        ALTER TABLE dictionary_entry
            ADD COLUMN hsk_level INT NULL,
            ADD COLUMN pos_tags JSON NOT NULL DEFAULT (JSON_ARRAY()),
            ADD KEY ix_dictionary_entry_hsk_level (hsk_level)
    """)


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("""
        ALTER TABLE dictionary_entry
            DROP KEY ix_dictionary_entry_hsk_level,
            DROP COLUMN pos_tags,
            DROP COLUMN hsk_level
    """)
