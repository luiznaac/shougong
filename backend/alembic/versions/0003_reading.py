"""reading

Revision ID: 0003_reading
Revises: 0002_dictionary_hsk
Create Date: 2026-09-09 12:51:34.666592

Adds the reading-practice feature's three tables (reading_text, reading_topic,
reading_word_usage), including reading_text's max_attempts/speakers columns from day one — unlike
the equivalent ALTER TABLE backend/README.md previously documented, this repository never shipped
reading_text without them, so there is nothing to catch up separately. Also carries the 36-row
starter scenario list that used to live in mysql/init.sql's INSERT IGNORE.
"""

from __future__ import annotations

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0003_reading"
down_revision: str | Sequence[str] | None = "0002_dictionary_hsk"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_SCENARIOS = (
    "a small thing goes wrong while cooking dinner",
    "someone forgets a bag on the bus and tries to get it back",
    "two friends cannot agree on which film to watch",
    "a package arrives addressed to the wrong person",
    "the weather ruins a carefully made weekend plan",
    "getting on the wrong train and noticing too late",
    "a phone dies at the worst possible moment",
    "a lost dog turns up in the neighbourhood",
    "the price at the market does not match the label",
    "a child refuses to go to school this morning",
    "running late while every little thing slows you down",
    "a surprise visitor knocks just before dinner",
    "trying a new restaurant that turns out disappointing",
    "a neighbour plays music too loud again tonight",
    "finding some money on the pavement",
    "a recipe needs one ingredient the kitchen does not have",
    "the first day at a new job",
    "waiting far too long at the doctor's office",
    "borrowing something from a friend and forgetting to return it",
    "a birthday plan that almost falls apart at the last minute",
    "the lift is broken and you live high up",
    "a cat that will not come down from the tree",
    "buying a gift and not being sure it is the right one",
    "a long queue at the bank when you are in a hurry",
    "a misunderstanding over a text message",
    "the last bus of the night does not come",
    "a plant that keeps dying no matter what you try",
    "spilling coffee right before an important meeting",
    "a shop assistant who is unusually kind",
    "losing a key and searching the whole house for it",
    "a rainy afternoon with nothing to do",
    "a friend who is always late, this time worse than ever",
    "discovering the fridge broke while you were away",
    "a stranger asks for directions to a place you do not know",
    "moving a heavy piece of furniture up the stairs",
    "a quiet morning that turns out to be a holiday you forgot",
)


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("""
        CREATE TABLE IF NOT EXISTS reading_text (
            id                       BIGINT       NOT NULL AUTO_INCREMENT,
            format                   VARCHAR(16)  NOT NULL,
            max_extra_words          INT          NOT NULL,
            max_attempts             INT          NOT NULL DEFAULT 3,
            topic                    VARCHAR(255) NULL,
            topic_generated          TINYINT(1)   NOT NULL DEFAULT 0,
            model                    VARCHAR(128) NOT NULL DEFAULT '',
            known_word_count         INT          NOT NULL,
            tokens                   JSON         NOT NULL,
            attempts                 JSON         NOT NULL DEFAULT (JSON_ARRAY()),
            working_set              JSON         NOT NULL DEFAULT (JSON_OBJECT()),
            must_use                 JSON         NOT NULL DEFAULT (JSON_ARRAY()),
            speakers                 JSON         NOT NULL DEFAULT (JSON_ARRAY()),
            created_at               DATETIME(6)  NOT NULL,
            PRIMARY KEY (id),
            KEY ix_reading_text_created_at (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS reading_topic (
            id          BIGINT       NOT NULL AUTO_INCREMENT,
            scenario    VARCHAR(255) NOT NULL,
            active      TINYINT(1)   NOT NULL DEFAULT 1,
            created_at  DATETIME(6)  NOT NULL,
            PRIMARY KEY (id),
            UNIQUE KEY uq_reading_topic_scenario (scenario)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """)
    op.execute("""
        CREATE TABLE IF NOT EXISTS reading_word_usage (
            simplified    VARCHAR(64)  NOT NULL,
            uses          INT          NOT NULL DEFAULT 0,
            last_used_at  DATETIME(6)  NULL,
            PRIMARY KEY (simplified)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    """)

    for scenario in _SCENARIOS:
        escaped = scenario.replace("'", "''")
        op.execute(f"INSERT IGNORE INTO reading_topic (scenario, created_at) VALUES ('{escaped}', NOW(6))")


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("DROP TABLE IF EXISTS reading_word_usage")
    op.execute("DROP TABLE IF EXISTS reading_topic")
    op.execute("DROP TABLE IF EXISTS reading_text")
