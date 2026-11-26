---
title: HanziHero → shougong one-way sync — data access and mapping
source: HanziHero official docs and community forum; the user's authenticated CSV exports (2026-11-23); shougong source
date: 2026-11-23
status: research
---

# HanziHero → shougong one-way sync — data access and mapping

## Question

Import the characters, words, and dictionary items a learner already knows on HanziHero into shougong, one way only (HanziHero → shougong, never back).

## Summary

HanziHero has no public REST API, but it ships an authenticated CSV export of the user's *known* items, one file per item type. shougong already has a batch-import seam that resolves rows by exact hanzi + numbered pinyin (`POST /study-items/batch`), and HanziHero's export carries exactly those two columns. The sync is therefore a thin adapter over an existing use case, not new domain code. One transform is required: HanziHero's `numbered_pinyin` has no syllable spaces (`shou3gong1`); shougong requires them (`shou3 gong1`).

## Data access (HanziHero)

HanziHero is a Phoenix app behind a cookie session. Staff (phil, kevin) confirm there is no REST API and that one is only a backlog idea (forum, 2024-01 through 2026-09).

The export is a URL suffix: append a **lowercase** `.csv` to any item list route.

| Item type | URL | Result |
| --- | --- | --- |
| Characters | `GET https://hanzihero.com/simplified/characters.csv` | `200 text/plain; charset=utf-8` |
| Words | `GET https://hanzihero.com/simplified/words.csv` | `200 text/plain; charset=utf-8` |
| Dictionary items | `GET https://hanzihero.com/simplified/my-dictionary.csv` | `200 text/plain; charset=utf-8` |
| Components | `GET https://hanzihero.com/simplified/components.csv` | out of scope |
| Sounds | `GET https://hanzihero.com/simplified/sounds.csv` | out of scope |

- `.CSV` (uppercase) 404s — the suffix is case-sensitive.
- `/simplified/hanzi.csv` 404s; the docs' `/hanzi` link is stale. Use `/characters`.
- Auth: unauthenticated requests 303-redirect to `/users/log_in`. A logged-in browser GET returns the CSV. CSRF is not expected to be needed for GET (Phoenix does not enforce it on safe methods); **unverified in practice**. The session cookie's name is **unverified**.
- Responses are `Cache-Control: max-age=0, private, must-revalidate` — always fresh.
- ToS: exporting one's own data at low frequency is within authorization. The terms forbid placing "undue burden on the Company's servers through automated means" and accessing the Service "in ways that exceed your authorization". `robots.txt` disallows nothing. No rate limit was observed.
- Observed sizes for the captured account: characters 14,395 B, words 12,260 B (uncompressed).

"Known" is the user's learned set: new, familiar, and finished items **plus skipped items**, the latter flagged by the `skipped` column (added 2025-02-25).

## CSV schema (captured 2026-11-23)

`characters.csv`:

```
character,pinyin,meaning,srs_stage,numbered_pinyin,alternate_meanings,user_synonyms,user_notes,skipped
一,yī,one,8,yi1,1,,,false
不,bù,no,8,bu4,not,,,false
了,le,did,8,le5,,,,false
```

`words.csv`:

```
word,pinyin,meaning,srs_stage,numbered_pinyin,alternate_meanings,user_synonyms,user_notes,skipped
一一,yīyī,one by one,8,yi1yi1,,,,false
手工,shǒugōng,handmade,7,shou3gong1,made by hand;handwork;by hand;done by hand;handicraft;handiwork,,,false
大人,dàrén,adult,8,da4ren2,,,,false
```

Field notes:

- Column 1 is `character` (single hanzi) or `word` (multi-character) in the two word-list exports, and `entry` in `my-dictionary.csv`; in all three it is the join key to `dictionary_entry.simplified`.
- `pinyin` is tone-mark pinyin with no spaces; `numbered_pinyin` is tone-number pinyin using `v` for ü (`nv3`, `lv4`) and **no syllable spaces**.
- `meaning` is the primary English gloss; `alternate_meanings` and `user_synonyms` are `;`-separated and may be empty; `user_notes` is free text.
- `srs_stage` is an integer 0–8. 8 is the final stage (finished). 0 appears both for skipped rows and for rows not yet reviewed. HanziHero docs define *familiar* as the first time an item reaches stage 3.
- `skipped` is `true`/`false`.
- The file is RFC 4180 CSV: fields containing commas are quoted, e.g. `"10k;10 thousand;10000;10,000"`. Multi-values inside a field use `;`. UTF-8, no BOM observed.
`my-dictionary.csv`:

```
entry,pinyin,primary_definition,srs_stage,numbered_pinyin,definitions,user_definitions,user_notes,skipped
之中,zhīzhōng,inside,1,zhi1zhong1,inside::among::in the midst of (doing sth)::during,,,false
便宜,piányi,cheap; inexpensive,5,pian2yi5,cheap; inexpensive::a petty advantage::to let sb off lightly,,,false
便宜,biànyí,cheap,2,bian4yi2,convenient,cheap,,true
```

- `my-dictionary.csv` names column 1 `entry` (not `word`/`character`) but it is the same hanzi join key. `primary_definition` is the chosen gloss; `definitions` is the full CC-CEDICT gloss list joined with `::`; `user_definitions` is the learner's own (may be empty).
- The same `entry` can appear more than once with different `numbered_pinyin` readings (the captured file has 便宜 as both `pian2yi5` and `bian4yi2`), so a row is identified by entry + reading, not entry alone — which is exactly what shougong's hanzi + numbered-pinyin match already does.

## What "learned" means in HanziHero

Item types are sound, component, character, word, and dictionary item (the last vendored from CC-CEDICT). The lifecycle is new (lesson completed) → familiar (first reaching SRS stage 3) → finished (final stage, no longer reviewed). *Skipped* is an extra state that counts as familiar and unlocks dependent words. *Dependent* is a relation, not a state. The export is "all of the known items of each type" — learned plus skipped.

## Mapping to shougong

- `dictionary_entry` is CC-CEDICT, simplified only, with pinyin sanitised on import (lower-cased, ü written as `v`). Join on `simplified`, never on pinyin.
- shougong's "known vocabulary" is every entry that has a `study_item`, regardless of FSRS state (`IStudyItemRepository.list_known_entries`). The sync's effect is therefore: create a `study_item` for each HanziHero known item that matches a dictionary entry.
- Existing seam: `StudyService.import_batch` behind `POST /study-items/batch` (`{ "rows": [{ "hanzi": "...", "pinyin": "..." }] }`, max 1000 rows). Each row is resolved by exact hanzi + numbered-pinyin match, created with a fresh FSRS card, and reported per row as created / skipped / error — a bad row is reported, never raised.
- Required transform: split `numbered_pinyin` into syllables by inserting a space after each tone digit — `shou3gong1` → `shou3 gong1`, `nv3er2` → `nv3 er2`. shougong's `is_numbered_pinyin` accepts only space-joined syllables (`[a-zA-Z:]+[1-5]`), and its `sanitize_pinyin` lowercases and maps ü to `v`, which matches HanziHero's `nv3`/`lv4` spelling.
- Characters and words both flow through the same path: single hanzi and multi-character words both exist as CC-CEDICT entries.
- Dictionary items are CC-CEDICT-derived on both sides; match on the `entry` column (== `dictionary_entry.simplified`) plus the reading, and expect an entry to appear once per reading.
- Not imported: `srs_stage` (shougong runs its own FSRS and starts a new card at the beginning), `meaning` and `pinyin` (the dictionary entry already holds them), `user_synonyms` and `user_notes` (no shougong counterpart).
- Unresolved rows: HanziHero's words are handpicked (5,400+), not strictly CC-CEDICT, so expect some `NOT_FOUND`; ambiguous readings carry candidates for manual resolution.

## Open questions for the design pass

1. Whether shougong's "learned" should include HanziHero `skipped=true` rows, or only `skipped=false`. Both are "known" on HanziHero.
2. Whether `srs_stage` should be ignored (likely) or used, e.g. to exclude finished items.
3. How the fetch is authenticated — a stored session cookie, a manual CSV upload, or a server-side job. The repo's secrets convention applies: a real secret never lives in the repo or defaults in code.
4. Whether a sync needs its own `ItemSource` value and provenance, or reuses `ItemSource.IMPORT`.
5. Idempotency: `import_batch` already skips entries that are queued, so re-running is safe; confirm the desired behaviour if an item is later removed from shougong.

## Sources

- HanziHero docs: `/docs/items`, `/docs/characters`, `/docs/words`, `/docs/dictionary-items`, `/docs/familiar-items`, `/docs/finished-items`, `/docs/dependent-items`, `/docs/items-learned`, `/docs/srs-stages`.
- https://community.hanzihero.com/t/custom-study-dictionary-beta-updates/4574 — CSV export announcement, 2025-02-07.
- https://community.hanzihero.com/t/feature-request-export-character-list/4086 — route, case sensitivity.
- https://community.hanzihero.com/t/csv-export-upgrade-skipped-dictionary/4804 — `::` delimiter and `skipped` column, 2025-02-25.
- https://community.hanzihero.com/t/hanzihero-api-for-user-apps/312 — no REST API.
- https://hanzihero.com/terms and https://hanzihero.com/robots.txt.
- Authenticated exports captured by the user on 2026-11-23: `characters.csv`, `words.csv`, `my-dictionary.csv`.
- shougong: `backend/src/shougong/usecase/study/service.py` (`import_batch`), `backend/src/shougong/usecase/dictionary/pinyin.py`, `backend/src/shougong/httpapi/controller/study_controller.py`.
