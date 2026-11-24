# HSK and dictionary data sourcing

The dictionary is built from two upstreams: CC-CEDICT for words (hanzi, pinyin, meanings) and an HSK dataset for levels and POS. The previous HSK source merged HSK 2.0 and HSK 3.0 and fell back to the 2.0 scale, so one `hsk_level` column mixed two vocabularies; CC-CEDICT was imported verbatim, including "old variant of X" alias rows that collide with the real entry on `(simplified, pinyin)` and block batch import. We decided to source **word vocabulary levels from the official HSK 3.0 list** (11,092 words; levels 1-6 plus a single 7-9 band), **character handwriting levels from the official character list** (`WritingLevel`), and to **keep the community ICTCLAS POS tags**, joined by simplified form. `hsk_level` is HSK 3.0 only — words outside it are null, and levels 8 and 9 are removed because the standard never subdivides 7-9. On import, CC-CEDICT drops an alias row only when the same character has a real entry (1,254 rows; this keeps the 5,786 characters that exist only as variants searchable) and drops byte-identical duplicate rows. Genuine homographs (`下面` "below" vs "to boil noodles") stay as separate rows and are reported as ambiguous at batch import for the learner to resolve. Search groups by hanzi+pinyin for display only, before pagination; storage stays one row per record.

## Considered Options

- **Fully official POS** — rejected: the official list's POS is coarser (a flat `N`), which would collapse the PERSON and PLACE categories the reading working set samples from.
- **Keep the community word levels** — rejected: less authoritative than the official list, and the reason the 2.0 blend existed.
- **Drop all variant-only rows** — rejected: it erases 5,786 characters (archaic forms and informal words like `B格`) for no extra import benefit.
- **Merge same-`(simplified, pinyin)` homographs into one row** — rejected: it conflates distinct words.
- **Group only in the frontend** — rejected: a group can be split across pages.

## Consequences

Enrichment becomes a versioned pass: it records an enrichment version and re-runs when the code's version changes, updating rows in place so existing databases get the new levels without a full reload. Existing data is cleaned up in place (alias and exact-duplicate rows removed), preserving row ids and study history. The grouped search response and the new handwriting level must be mirrored in `frontend/src/api/types.ts`.
