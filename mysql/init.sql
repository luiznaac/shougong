USE shougong;

-- CC-CEDICT entries, trimmed to simplified form + pinyin + English glosses.
-- Populated by scripts/load_cedict.py (see README), never seeded here.
CREATE TABLE IF NOT EXISTS dictionary_entry (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    simplified  VARCHAR(64)  NOT NULL,
    pinyin      VARCHAR(191) NOT NULL,
    definitions JSON         NOT NULL,
    PRIMARY KEY (id),
    KEY ix_dictionary_entry_simplified (simplified),
    KEY ix_dictionary_entry_pinyin (pinyin)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Dictionary entries the learner is studying, with their flattened FSRS card.
CREATE TABLE IF NOT EXISTS study_item (
    id               BIGINT      NOT NULL AUTO_INCREMENT,
    entry_id         BIGINT      NOT NULL,
    card_state       SMALLINT    NOT NULL,
    card_stability   DOUBLE      NULL,
    card_difficulty  DOUBLE      NULL,
    card_due         DATETIME(6) NOT NULL,
    card_last_review DATETIME(6) NULL,
    created_at       DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_study_item_entry (entry_id),
    KEY ix_study_item_card_due (card_due),
    CONSTRAINT fk_study_item_entry FOREIGN KEY (entry_id)
        REFERENCES dictionary_entry (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Append-only history of grades: one row per review of a study item.
CREATE TABLE IF NOT EXISTS review_log (
    id              BIGINT      NOT NULL AUTO_INCREMENT,
    study_item_id   BIGINT      NOT NULL,
    rating          SMALLINT    NOT NULL,
    review_datetime DATETIME(6) NOT NULL,
    PRIMARY KEY (id),
    KEY ix_review_log_study_item (study_item_id),
    CONSTRAINT fk_review_log_study_item FOREIGN KEY (study_item_id)
        REFERENCES study_item (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
