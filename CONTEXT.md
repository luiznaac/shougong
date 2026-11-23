# Domain glossary

The vocabulary of the handwriting trainer. Terms are defined in the product's language; the code that implements them lives elsewhere (start at the [code map](docs/code-map.md)).

- **Study item** — a dictionary entry the learner has queued for practice; the unit the scheduler tracks.
- **Dictionary entry** — a simplified-Chinese word with its pinyin, definitions, HSK level and part-of-speech tags. One word can have more than one entry when it has more than one reading.
- **Known vocabulary** — every word the learner currently studies, treated as a whole string: knowing its characters does not make a compound known.
- **Card** — the scheduling state attached to a study item: its stage, stability, difficulty and next due time.
- **SRS** — spaced repetition: scheduling each card to come back just before it would be forgotten.
- **FSRS** — the scheduling algorithm that estimates a card's stability and difficulty from its review history.
- **Review** — one graded recall of a due study item, kept in an append-only log.
- **Grade** — the learner's assessment of a review: again, hard, good or easy.
- **Lesson** — the session that introduces a new study item before it joins the review queue.
- **Learning** — the stage of a study item that has been added but not yet graduated.
- **Review stage** — the stage a study item enters after its first review, where FSRS reschedules it.
- **Graduation** — the move from learning to the review stage.
- **Day boundary** — the local midnight at which a day's due cards all become available together, favouring one daily session.
- **Stability** — how long, in days, the scheduler expects the memory to last.
- **Difficulty** — how hard the scheduler expects the item to be to retain.
- **Leech** — a study item that keeps being graded again; flagged for attention.
- **Pin / priority** — a manual ordering that floats a learning item to the front of its next session.
- **HSK** — the standardized Chinese proficiency scale. A word's **vocabulary level** comes from the official HSK 3.0 word list (levels 1–6 plus the single 7–9 band, stored as 7); a word outside the list has no level. The community dataset supplies the POS tags, not the level.
- **Stroke** — one pen movement of a character; its order is the sequence a learner reproduces.
- **Reading** — a generated Mandarin text for reading practice.
- **Reading generation** — the pipeline that asks a language model for a text constrained to the learner's known vocabulary.
- **Working set** — the vocabulary budget a reading is built from: function words plus a quota of content words by kind.
- **Extra word** — a word in a reading that is outside the known vocabulary; allowed only up to a fixed ceiling.
- **Topic** — the subject a reading is asked to cover.
- **Comprehensible input** — a text the learner can read almost entirely, with a small controlled amount of new language.
- **Vocabulary profile** — the learner's queued words summarized by HSK level and grammatical class.
- **HSK coverage** — how much of each HSK level the learner's vocabulary already covers.
- **Snapshot** — a record of a study item's card state at a change, kept so its trajectory can be plotted.
- **Trajectory** — a study item's stability and difficulty over time, read from its snapshots.
- **Insight** — a derived summary over the study data, such as leeches, the due forecast or the learned curve.
