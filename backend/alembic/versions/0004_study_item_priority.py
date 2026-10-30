"""study_item_priority

Revision ID: 0004_study_item_priority
Revises: 0003_reading
Create Date: 2026-10-30 15:22:16.223001

Adds the lesson-queue pin table. One row per prioritised study item (row presence is
membership); `position` is a signed display-ordering key indexed for the min/max edge
reads, with no unique constraint so a duplicate from a write race still orders by
position then id. The foreign key cascades when the study item is deleted.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0004_study_item_priority"
down_revision: str | Sequence[str] | None = "0003_reading"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "study_item_priority",
        sa.Column("study_item_id", sa.BigInteger(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["study_item_id"], ["study_item.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("study_item_id"),
    )
    op.create_index(op.f("ix_study_item_priority_position"), "study_item_priority", ["position"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_study_item_priority_position"), table_name="study_item_priority")
    op.drop_table("study_item_priority")
