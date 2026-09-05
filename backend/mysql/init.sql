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

-- Per-character stroke order data (SVG paths + medians), from the hanzi-writer-data
-- npm package (built from the open "Make Me a Hanzi" dataset). Fetched lazily and
-- cached one row per character on first lookup. has_data=0 rows are a negative
-- cache (e.g. punctuation with no stroke data) so we don't re-fetch every time.
-- `character` is quoted throughout: it's a reserved word in MySQL 8, so an
-- unquoted column definition fails at table-creation time.
CREATE TABLE IF NOT EXISTS character_strokes (
    `character` VARCHAR(8)  NOT NULL,
    has_data    TINYINT(1)  NOT NULL,
    strokes     JSON        NULL,
    medians     JSON        NULL,
    PRIMARY KEY (`character`)
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
        REFERENCES dictionary_entry (id)
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
        REFERENCES study_item (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Append-only trail of study_item state: the card columns copied from study_item
-- plus this row's own created_at, one row written when the item is created and one
-- after every change.
CREATE TABLE IF NOT EXISTS study_item_history (
    id               BIGINT      NOT NULL AUTO_INCREMENT,
    study_item_id    BIGINT      NOT NULL,
    created_at       DATETIME(6) NOT NULL,
    entry_id         BIGINT      NOT NULL,
    card_state       SMALLINT    NOT NULL,
    card_stability   DOUBLE      NULL,
    card_difficulty  DOUBLE      NULL,
    card_due         DATETIME(6) NOT NULL,
    card_last_review DATETIME(6) NULL,
    PRIMARY KEY (id),
    KEY ix_study_item_history_item_created (study_item_id, created_at),
    CONSTRAINT fk_study_item_history_study_item FOREIGN KEY (study_item_id)
        REFERENCES study_item (id),
    CONSTRAINT fk_study_item_history_entry FOREIGN KEY (entry_id)
        REFERENCES dictionary_entry (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Generated reading-practice texts, kept as a revisitable history. `tokens` is
-- the fully resolved word/punctuation breakdown at generation time (pinyin,
-- definitions, part of speech, is_extra, dictionary_entry_id) — stored as
-- shown, not recomputed against the dictionary/vocabulary on every read.
-- `known_word_count` is the size of the known-vocabulary set sent to the model.
CREATE TABLE IF NOT EXISTS reading_text (
    id                       BIGINT       NOT NULL AUTO_INCREMENT,
    format                   VARCHAR(16)  NOT NULL,
    max_extra_words          INT          NOT NULL,
    topic                    VARCHAR(255) NULL,
    known_word_count         INT          NOT NULL,
    tokens                   JSON         NOT NULL,
    created_at               DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    KEY ix_reading_text_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
