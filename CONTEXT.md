# shougong

A Chinese handwriting trainer with a spaced-repetition engine and vocabulary-restricted AI reading practice.

## Language

**Study item**:
A dictionary entry the learner has queued for practice, together with its FSRS scheduling state.
_Avoid_: card, flashcard

**Known vocabulary**:
Every dictionary entry the learner has a study item for, regardless of FSRS state. It is the vocabulary the reading engine is allowed to use.
_Avoid_: learned words, lexicon

**Sync** (HanziHero sync):
The one-way, additive import of the learner's known HanziHero items into shougong as study items. It never deletes or updates existing items.
_Avoid_: mirror, two-way sync, export

**Skipped item**:
A HanziHero item the learner marked as known without drilling it. Skipped items are excluded from the sync.
_Avoid_: known item
