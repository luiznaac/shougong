---
status: accepted
date: 2026-11-26
---

# Handwriting is an ungraded self-check

Shougong's handwriting step auto-graded stroke order and pre-selected "Errei" whenever the mistake count exceeded a tolerance that defaulted to 0%. That turned a small slip or a legitimate stroke variant into an SRS lapse, and the learner never saw the model before the grade existed. We decided the handwriting step is an ungraded self-check: hanzi-writer still captures the drawing stroke by stroke, but its mistake count is ignored and no grade is pre-selected; after the last character the learner compares their drawing with the model and chooses one of the four SRS grades. The evidence supports this: strict stroke-order auto-fail is not a supported learning target, a 0% tolerance turns technical slips into lapses, and learners grade themselves leniently — so the app keeps the schedule but lets the learner own the grade.

## Considered options

- **Keep strict auto-grading with a relaxed tolerance.** Rejected: it still maps a technicality to Again, and no evidence supports a specific tolerance threshold.
- **Free-draw without stroke matching.** Rejected: it loses per-stroke guidance and the stroke data the app already fetches, for no gain over ignoring the library's grade.

## Consequences

- The tolerance-percent setting and the mistake-allowance helper are removed; handwriting stays a per-browser toggle, off by default.
- The reveal needs a comparison view (the learner's drawing beside the model) and a new auto-reveal preference, on by default.
- The SRS grade is manual for every handwriting item; no rating is ever pre-selected, and Practice runs the same self-check without recording a grade.
- Research: `docs/research/handwriting-ux.md` on branch `research/handwriting-ux`.
