# Handwriting is an ungraded self-check

Status: accepted

Shougong's handwriting step used to auto-grade stroke order and pre-select "Errei" whenever the mistake count exceeded a tolerance that defaulted to 0%. We decided the step is an ungraded self-check instead: hanzi-writer still captures the drawing stroke by stroke, but its mistake count is ignored; after the last character the learner compares their drawing with the model and chooses one of the four SRS grades. The evidence does not support strict stroke-order auto-fail as a learning target, a 0% tolerance turned small slips into lapses, and learners grade themselves leniently, so the app keeps the schedule but lets the learner own the grade.

## Considered options

- **Keep strict auto-grading with a relaxed tolerance.** Rejected: it still maps a technicality to Again, and no evidence supports a specific tolerance threshold.
- **Free-draw without stroke matching.** Rejected: it loses per-stroke guidance and the stroke data the app already fetches, for no gain over ignoring the library's grade.

## Consequences

- The tolerance-percent setting and `allowedMistakes` are removed; handwriting stays a per-browser toggle, off by default.
- The reveal needs a comparison view (learner drawing beside the model) and a new auto-reveal preference.
- The SRS grade is manual for every handwriting item; no rating is ever pre-selected.
- Research: `docs/research/handwriting-ux.md` on branch `research/handwriting-ux`.
