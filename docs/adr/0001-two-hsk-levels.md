# Two HSK levels: vocabulary for words, handwriting for characters

The 2021 HSK standard grades two different things: a **vocabulary level** per word (词汇表) and a **handwriting level** per character (手写汉字表, the `WritingLevel` field). shougong drills handwriting on characters but stored a single word-level `hsk_level`, so a handwriting card showed the word's level rather than the characters' writing level. These genuinely differ: 9,622 of 11,092 words (87%) have a word level different from the max writing level of their characters (e.g. `班` is vocabulary level 1 but writing level 2; `爱人` is vocabulary level 2 but `爱` and `人` are both writing level 1). We decided to keep both: `hsk_level` stays the **vocabulary level** for reading, proficiency and dictionary search, and a new **handwriting level** is stored per character from the official list for the study/handwriting surfaces. A word's handwriting level is the **max** of its characters' writing levels — a word is hand-writable only once every character in it is — used as a filter/sort key while the card can show the real per-character levels.

## Considered Options

- **One word-level number everywhere** — rejected: 87% divergence, so handwriting cards would show a misleading level.
- **Per-character only, no word rollup** — rejected: the study queue and its filters are word-based.
- **Min rollup for a word** — rejected: it overstates ability and offers words containing characters the learner cannot yet write.

## Consequences

`dictionary_entry` gains a derived `handwriting_level`; a character-level source of truth holds the official `WritingLevel` per character. Study card, study filter and related ordering use the handwriting level; dictionary search and the reading/proficiency path keep the vocabulary level. The API response and `frontend/src/api/types.ts` expose both levels.
