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
