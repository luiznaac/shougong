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
-- the word/punctuation breakdown (text, part of speech, is_extra) —
-- deliberately WITHOUT pinyin, definitions, or a dictionary id, which the app
-- re-resolves by word text (batched) from dictionary_entry on every read
-- instead of freezing a copy here. `known_word_count` is the size of the
-- known-vocabulary set sent to the model. `model` is the LiteLLM model id the
-- caller picked for this generation (empty string on rows predating that field).
-- `attempts` is the full generation trail — every draft the correction loop
-- produced, kept even when discarded, one flagged `chosen` (`[]` on old rows).
-- `working_set` is the vocabulary offered to the model for this generation
-- ({group: [words]}), `must_use` its anchor words (`{}`/`[]` on old rows).
-- `topic_generated` is 1 when the code drew the topic from `reading_topic`
-- (the free-text topic was blank).
CREATE TABLE IF NOT EXISTS reading_text (
    id                       BIGINT       NOT NULL AUTO_INCREMENT,
    format                   VARCHAR(16)  NOT NULL,
    max_extra_words          INT          NOT NULL,
    topic                    VARCHAR(255) NULL,
    topic_generated          TINYINT(1)   NOT NULL DEFAULT 0,
    model                    VARCHAR(128) NOT NULL DEFAULT '',
    known_word_count         INT          NOT NULL,
    tokens                   JSON         NOT NULL,
    attempts                 JSON         NOT NULL DEFAULT (JSON_ARRAY()),
    working_set              JSON         NOT NULL DEFAULT (JSON_OBJECT()),
    must_use                 JSON         NOT NULL DEFAULT (JSON_ARRAY()),
    created_at               DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    KEY ix_reading_text_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- The editable list of everyday scenarios (a small arc each) the generator
-- draws from when the learner leaves the free-text topic blank. Seeded here so a
-- fresh database always has a usable list; the reading screen can edit it.
-- `active=0` keeps a scenario but takes it out of the draw.
CREATE TABLE IF NOT EXISTS reading_topic (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    scenario    VARCHAR(255) NOT NULL,
    active      TINYINT(1)   NOT NULL DEFAULT 1,
    created_at  DATETIME(6)  NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_reading_topic_scenario (scenario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO reading_topic (scenario, created_at) VALUES
  ('a small thing goes wrong while cooking dinner', NOW(6)),
  ('someone forgets a bag on the bus and tries to get it back', NOW(6)),
  ('two friends cannot agree on which film to watch', NOW(6)),
  ('a package arrives addressed to the wrong person', NOW(6)),
  ('the weather ruins a carefully made weekend plan', NOW(6)),
  ('getting on the wrong train and noticing too late', NOW(6)),
  ('a phone dies at the worst possible moment', NOW(6)),
  ('a lost dog turns up in the neighbourhood', NOW(6)),
  ('the price at the market does not match the label', NOW(6)),
  ('a child refuses to go to school this morning', NOW(6)),
  ('running late while every little thing slows you down', NOW(6)),
  ('a surprise visitor knocks just before dinner', NOW(6)),
  ('trying a new restaurant that turns out disappointing', NOW(6)),
  ('a neighbour plays music too loud again tonight', NOW(6)),
  ('finding some money on the pavement', NOW(6)),
  ('a recipe needs one ingredient the kitchen does not have', NOW(6)),
  ('the first day at a new job', NOW(6)),
  ('waiting far too long at the doctor''s office', NOW(6)),
  ('borrowing something from a friend and forgetting to return it', NOW(6)),
  ('a birthday plan that almost falls apart at the last minute', NOW(6)),
  ('the lift is broken and you live high up', NOW(6)),
  ('a cat that will not come down from the tree', NOW(6)),
  ('buying a gift and not being sure it is the right one', NOW(6)),
  ('a long queue at the bank when you are in a hurry', NOW(6)),
  ('a misunderstanding over a text message', NOW(6)),
  ('the last bus of the night does not come', NOW(6)),
  ('a plant that keeps dying no matter what you try', NOW(6)),
  ('spilling coffee right before an important meeting', NOW(6)),
  ('a shop assistant who is unusually kind', NOW(6)),
  ('losing a key and searching the whole house for it', NOW(6)),
  ('a rainy afternoon with nothing to do', NOW(6)),
  ('a friend who is always late, this time worse than ever', NOW(6)),
  ('discovering the fridge broke while you were away', NOW(6)),
  ('a stranger asks for directions to a place you do not know', NOW(6)),
  ('moving a heavy piece of furniture up the stairs', NOW(6)),
  ('a quiet morning that turns out to be a holiday you forgot', NOW(6));

-- How often, and how recently, each word has appeared in a generated reading.
-- The working-set sampler down-weights recently used words so practice rotates.
CREATE TABLE IF NOT EXISTS reading_word_usage (
    simplified    VARCHAR(64)  NOT NULL,
    uses          INT          NOT NULL DEFAULT 0,
    last_used_at  DATETIME(6)  NULL,
    PRIMARY KEY (simplified)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- One row per word in the study queue: its HSK level, the raw HSK POS tags, and
-- the broad `pos_category` derived from them (this app's own taxonomy) — used to
-- build a balanced working set for reading generation. Resolved from the HSK
-- dataset on startup; `source='manual'` rows are user overrides a resync leaves
-- alone, `source='unknown'` means the word isn't in the HSK list.
CREATE TABLE IF NOT EXISTS vocabulary_profile (
    simplified    VARCHAR(64)  NOT NULL,
    hsk_level     INT          NULL,
    pos_tags      JSON         NOT NULL,
    pos_category  VARCHAR(16)  NOT NULL,
    source        VARCHAR(16)  NOT NULL,
    updated_at    DATETIME(6)  NOT NULL,
    PRIMARY KEY (simplified)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
