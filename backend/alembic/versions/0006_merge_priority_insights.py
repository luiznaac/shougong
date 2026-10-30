"""merge priority and insights heads

Revision ID: 0006_merge_priority_insights
Revises: 0004_study_item_priority, 0005_insights
Create Date: 2026-10-30 18:55:00.000000

The queue-core (0004) and insights (0005) revisions both branched from 0003, so
the merged tree has two heads. This empty revision joins them into one head; no
schema change of its own.
"""

from __future__ import annotations

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "0006_merge_priority_insights"
down_revision: str | Sequence[str] | None = ("0004_study_item_priority", "0005_insights")
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""


def downgrade() -> None:
    """Downgrade schema."""
