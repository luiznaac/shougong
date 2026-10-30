"""insights

Revision ID: 0005_insights
Revises: 0003_reading
Create Date: 2026-10-30 15:29:18.134664

Swaps the review-log indexes for the two insight reads. The covering
(study_item_id, review_datetime, id, rating) index serves both the leech window
and the per-item grade list, so the study_item_id-only index it supersedes is
dropped — the generated migration emits that drop; it was reviewed by hand.
(rating, review_datetime) serves the Extra Study mistake range.
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0005_insights"
down_revision: str | Sequence[str] | None = "0003_reading"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_index(
        "ix_review_log_study_item_window",
        "review_log",
        ["study_item_id", "review_datetime", "id", "rating"],
        unique=False,
    )
    op.drop_index("ix_review_log_study_item", table_name="review_log")
    op.create_index("ix_review_log_rating_datetime", "review_log", ["rating", "review_datetime"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_review_log_rating_datetime", table_name="review_log")
    op.create_index("ix_review_log_study_item", "review_log", ["study_item_id"], unique=False)
    op.drop_index("ix_review_log_study_item_window", table_name="review_log")
