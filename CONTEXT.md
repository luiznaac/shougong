# shougong

A handwriting trainer for simplified Chinese that also generates reading practice from the learner's known vocabulary. This glossary fixes the vocabulary the dictionary and HSK work turns on.

## Language

### Units

**Character** (汉字):
A single written hanzi — the unit of handwriting and stroke order (`行`, `学`).
_Avoid_: Letter, glyph

**Word** (词):
One or more characters treated as one lexical unit — the unit of meaning, vocabulary and reading (`行`, `学习`, `银行`).
_Avoid_: Term, entry

### HSK levels

**Vocabulary level**:
The HSK 3.0 level at which a *word* is introduced — the level of the 词汇表. Drives reading and proficiency, which work on words.
_Avoid_: HSK level (unqualified), word level

**Handwriting level**:
The HSK 3.0 level at which a *character* is expected to be written by hand — the level of the 手写汉字表. Drives handwriting practice, which works on characters. Distinct from the recognition character list (汉字表), which is larger.
_Avoid_: Writing level, stroke level, HSK level (unqualified)

### Dictionary sourcing

**Variant**:
A CC-CEDICT record whose gloss only points at another spelling or form of the same word (`old variant of 寇`, `variant of 從|从`), not a distinct word. Arises from orthographic variants and from distinct traditional forms collapsing onto one simplified character (後→后, 乾/幹→干).
_Avoid_: Duplicate, alias entry

**Reading** (of a hanzi):
One pronunciation of a character, carried on its own dictionary row (`行` as `xing2` "to walk" vs `hang2` "row"). A character can have several readings; each is a distinct entry.
_Avoid_: Sense, meaning
