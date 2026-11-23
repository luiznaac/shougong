---
source: web research (primary docs, source code, peer-reviewed papers)
branch: research/handwriting-ux
date: 2026-11-23
---

# Handwriting UX research — the draw-from-memory step

## Context: what shougong does today

The quiz's handwriting step is a single-character, blank-canvas recall exercise. `HandwritingQuiz` creates a `HanziWriter` with `showCharacter: false` and `showOutline: false`, runs `quiz()` with `showHintAfterMisses: false` and `markStrokeCorrectAfterMisses: 3`, and reports only pass/fail to its parent; cleanup is `cancelQuiz()` plus a manual container clear, since the library has no public destroy (`frontend/src/components/HandwritingQuiz.tsx:52`).

`Quiz` draws one character at a time at `sizePx={desktop ? 170 : 150}`, shows "caractere N/M" only for multi-character words, and on the last character moves to `revealed`, pre-selecting `again` if any character failed. There is no hint, outline, undo, clear, per-stroke feedback, reveal, or retry path (`frontend/src/components/Quiz.tsx:238`).

`useHandwritingEnabled` defaults to `false` and `useHandwritingTolerance` to `0`, with presets `[0,10,20,30,40,50]`; `allowedMistakes` is `floor(strokeCount * pct / 100)`, so the default allows zero mistakes (`frontend/src/lib/localSettings.ts:36`). Both settings appear in the quiz band and on the settings page (`frontend/src/components/PracticeBand.tsx:90`, `frontend/src/pages/Ajustes.tsx:25`); the copy is "Escreva o caractere à mão" then "Você acertou a escrita?" (`frontend/src/lib/quizPractice.ts:10`).

## 1. What hanzi-writer 3.7.3 can do

**Quiz surface.** `quiz()` accepts `leniency` (default 1), `showHintAfterMisses` (default 3, or `false`), `markStrokeCorrectAfterMisses` (false or a count), `quizStartStrokeNum`, `acceptBackwardsStrokes`, `highlightOnComplete`, an undocumented `averageDistanceThreshold` (350), and `onMistake`, `onCorrectStroke` and `onComplete` callbacks ([docs](https://chanind.github.io/hanzi-writer/docs.html)). Options merge live into a private `_options`, so there is no public mid-quiz setter.

**Stroke data.** `onMistake` and `onCorrectStroke` receive `StrokeData` with `character`, `strokeNum`, `mistakesOnStroke`, `totalMistakes`, `strokesRemaining`, `isBackwards` and the drawn path; `onComplete` receives only `{ character, totalMistakes }` — no per-stroke breakdown, so a richer rubric needs host-side accumulation.

**Hints and reveal.** A hint is a transient highlight of the correct stroke once `mistakesOnStroke >= showHintAfterMisses`; grading stays strict, and there is no persistent partial outline. Public `showOutline()`, `hideOutline()`, `showCharacter()` and `highlightStroke(n)` do work mid-quiz, so revealing the whole character is the de-facto "show answer" — the host must supply it.

**Undo, clear, skip.** There is no public undo, clear or destroy. `cancelQuiz()` stops grading and removes user strokes; calling `quiz()` again restarts and resets revealed strokes; `skipQuizStroke()` (3.7.0) force-advances one stroke ungraded. Cleanup is `cancelQuiz()` plus clearing the container, because the renderer's destroy removes only its positioned `<g>`, not the root `<svg>`.

**Rendering layers.** Three sibling SVG `<g>` layers — `outline`, `main`, `highlight` — sit under the user strokes inside one positioned `<g>`. A 米字格 grid, faint character or first-stroke ghost must be your own SVG siblings in the same target; `create()` accepts an existing `<svg>`/`<g>`. Raw ghost geometry comes from `HanziWriter.loadCharacterData()` + `getScalingTransform()` ([repo](https://github.com/chanind/hanzi-writer)).

**Input and scaling.** Input is mouse + touch only: `mousedown`/`mousemove`, `touchstart`/`touchmove` on the element, `mouseup`/`touchend` on `document`, reading `evt.touches[0]` only. No pointer events, pen, pressure or palm rejection. The SVG renderer uses `getScreenCTM` and is HiDPI-safe; the canvas renderer sets no `devicePixelRatio`. Releases 3.7.1/3.7.2 fixed "consistent stroke drawing in quiz mode on mobile" and rAF issues ([releases](https://github.com/chanind/hanzi-writer/releases)).

**One character per instance.** The string goes verbatim to the loader as `<char>.json`, so multi-character strings fail; missing data sets `loadingFailed` and makes `quiz()` a no-op. Completion fires once at the last stroke; input is ignored until a new `quiz()`.

**Grading internals.** `strokeMatches.ts` uses a cosine threshold of 0, a start/end distance threshold of 250, a Fréchet threshold of 0.4 and a minimum length threshold of 0.35. Later strokes get half the distance threshold unless the outline is visible. `markStrokeCorrectAfterMisses: 3` means two recorded misses, then the third attempt is force-accepted and counted.

## 2. How comparable apps run the step

**Canvas scaffold.** Tofu Learn traces with an outline first, then repeats without it; Hanzi Writer and Anki maobi default to a faint outline with a toggle; Skritter shows nothing but offers Reveal, a completed outline that fades as you write ([Tofu](https://www.tofulearn.com/chinese), [Skritter](https://docs.skritter.com/article/267-mobile-writing-canvas-and-study-screen-buttons), [maobi](https://github.com/jcklie/anki-maobi)). shougong's permanent blank canvas is the strictest of these.

**Hint model.** Skritter gives a one-tap stroke hint / long-press next stroke and prompts the correct stroke after a couple of wrong attempts; Hanzi Writer defaults `showHintAfterMisses: 3`. shougong has no hint at any miss count — stricter than the library it uses.

**Feedback timing.** Skritter, Tofu, Hanzi Writer, Dong Chinese and HelloChinese grade each stroke live. Pleco's writing test is deliberately end-of-card self-grade with no per-stroke correction, and Skritter's "rawest squigs" disables hints and auto-grading for end self-grading ([Pleco](https://www.pleco.com/manual/android/flash/), [raw squigs](https://blog.skritter.com/2014/07/improve-your-character-writing-by-enabling-raw-squigs/)). Silent end-grading exists elsewhere, but as an opt-in hard mode, not the default.

**Reveal, skip and SRS cost.** Skritter Reveal shows the answer; Teaching Mode marks the card incorrect (overridable). Tofu's "I don't know" stalls learning-stage progression. Pleco reveals then asks correct/incorrect. Hanzi Writer has no built-in show-answer; the host adds it ([writing modes](https://docs.skritter.com/article/281-writing-modes), [Skritter FAQ](https://ios.skritter.com/faq)). shougong's auto-"Errei" is a reveal-less skip, not a reveal.

**Grading and tolerance.** Automatic stroke grading is the norm; self-grade-after-reveal is the alternative. Tolerance is a visible knob in Hanzi Writer (`leniency`, `markStrokeCorrectAfterMisses`) and maobi (Leniency, Show hint after misses); Skritter exposes mode toggles (raw/rawest squigs, historically strictness and stroke-order weighting sliders) rather than a numeric percent ([strictness](https://blog.skritter.com/2008/10/control-thy-strictness/)). shougong's 0% default sits at the strictest end.

**Multi-character words.** Skritter writes a word's characters one after another in one canvas and auto-reveals hidden info only after the last; maobi runs one quiz per Hanzi with restart-current/all; Pleco fills a series of per-character boxes (up to four) ([study screen](https://docs.skritter.com/article/199-study-screen-overview), [maobi](https://ankiweb.net/shared/info/959635611)). Hanzi Writer is single-character only. shougong matches the library but loses the word-level progress cue Skritter shows.

**Input modes.** Everyone supports finger and mouse; Skritter adds a stylus mode and still recommends paper. Pleco's maintainer calls its writing test "more of a visual recall test than as writing practice" and steers stroke-order rigor to Skritter. "Blank, silent, from memory" is recognized, but usually as a hard mode rather than the default ([stroke-order guide](https://blog.skritter.com/2021/03/the-ultimate-guide-to-chinese-character-stroke-order/)).

## 3. What the learning evidence says

**Keep the blank attempt, then reveal.** Generation and production beat reading, but feedback after any retrieval attempt — including a failed one — is what makes the attempt productive. Do not loop retries before revealing ([Roediger & Butler 2011](https://bpb-us-e2.wpmucdn.com/sites.wustl.edu/dist/8/805/files/2026/06/Roediger-and-Butler-2011-The-critical-role-of-retrieval-practice-in-long-term-retention.pdf), [Kornell, Hays & Bjork 2009](https://bjorklab.psych.ucla.edu/wp-content/uploads/sites/13/2016/07/Kornell_Hays_Bjork_2009_JEP-LMC.pdf)).

**Grade the character, not the pen path.** Strict stroke-order auto-fail is not supported as a learning target: order effects on recognition and writing are null-to-modest and contested, legitimate order variants exist, and order is invisible on paper ([Hsiung et al. 2017](https://scholar.lib.ntnu.edu.tw/en/publications/effect-of-stroke-order-learning-and-handwriting-exercises-on-reco-2/), [Sun et al. 2024](https://www.tandfonline.com/doi/full/10.1080/09588221.2024.2443769), [Lam 2020](https://repository.um.edu.mo/bitstream/10692/39642/1/2021%20Lyu%2C%20Lai%2C%20Lin%2C%20%26%20Gong%202021.pdf)).

**A three-tier rubric.** Replace the binary zero-mistake threshold with: recognizable minor stroke shape/position deviation = pass; added, missing or altered strokes but still recognizable = partial; different character or illegible = fail ([Taiwan MOE rubric](https://school.tc.edu.tw/open-message/064611/get-file/5ec736fb8aeb013804703550)). This is an official standard, not experimental evidence.

**Objective floor, self-grade band.** Learners are systematically lenient even with the answer visible, so self-grade must not upgrade a clearly wrong character; keep an objective check as the grade floor and let self-grade shade only within a band ([Rawson & Dunlosky 2007](https://doi.org/10.1080/09541440701326022)).

**Do not map a technicality to "Again".** In FSRS/SM-2, Again is a lapse that collapses stability and forces relearning; reserve it for genuine recall failure, and put a correct-but-sloppy attempt at most at "Hard" ([FSRS tutorial](https://github.com/open-spaced-repetition/fsrs4anki/blob/main/docs/tutorial.md), [Anki deck options](https://docs.ankiweb.net/manual/deck-options), [Expertium](https://expertium.github.io/Algorithm.html)).

**Hints learner-invoked and grade-degrading.** An outline → first-stroke ghost → full ghost ladder helps when a task is too hard, but learners over-use bottom-out hints and snap-to-model assistance inflates the illusion of competence ([Koedinger & Aleven 2007](https://pact.cs.cmu.edu/pubs/Koedinger%20Aleven%2007.pdf), [Roll et al. 2007](https://pact.cs.cmu.edu/koedinger/pubs/Roll,%20Aleven,%20McLaren%20&%20Koedinger%202007.pdf)).

**Scaffold by item difficulty.** Outline or ghost for new or high-error characters, fading to blank, because desirable difficulties become undesirable when the learner lacks the knowledge to succeed ([Bjork & Bjork 2011](https://bjorklab.psych.ucla.edu/wp-content/uploads/sites/13/2016/11/Making-Things-Hard-on-Yourself-but-in-a-Good-Way-20111.pdf)).

## 4. Input and accessibility constraints

**Target size.** 150px is not a WCAG target-size failure: 2.5.8 (AA) is 24×24 CSS px, 2.5.5 (AAA) is 44×44, and a drawing surface counts as one target. It is still cramped for touch — a ~9mm fingertip covers a third of it. Growing under `(pointer: coarse)` to `min(90vw, ~280–320px)` and keeping ~170px for fine pointers is compatible with the resolution-independent SVG renderer ([2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [2.5.5](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html), [tap targets](https://web.dev/articles/accessible-tap-targets)).

**Touch handling.** Keep `touch-action: none` scoped to the SVG only, never an ancestor, because values intersect up to the scroll container. Pair it with `preventDefault()`, `user-select` / `-webkit-touch-callout: none`, `-webkit-tap-highlight-color: transparent`, and leave padding around the canvas because the canvas will no longer scroll the page ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action), [WebKit](https://webkit.org/blog/5610/more-responsive-tapping-on-ios/)).

**Legacy input layer.** The library uses `mousedown`/`touchstart`/`touchmove` on the element and `mouseup`/`touchend` on `document`, reads `evt.touches[0]` only, and has no `pointerType`, `pointercancel`, pointer capture, coalesced events or smoothing. A second finger or palm tap anywhere aborts the stroke; stylus is not distinguished; fast strokes render as an angular polyline. 3.7.1 fixed mobile stroke drawing ([pointer events](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events), [releases](https://github.com/chanind/hanzi-writer/releases)).

**Keyboard and AT.** Add a keyboard/AT equivalent rather than relying on the 2.1.1 exception: it covers path-dependent underlying functions, and a stroke-order quiz's underlying function is expressible as tap-the-next-stroke or stroke-order multiple choice. The SVG exposes nothing to AT, so name the region and announce progress in a live region ([2.1.1](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html)).

**Colour and motion.** Feedback must not be red-only (1.4.1); pair an error flash with an icon, short text and a `role="status"`/`aria-live="polite"` message ("Stroke 3 incorrect"). Check 1.4.11's 3:1 for the drawn stroke against the slate background — hanzi-writer's default `#DDD` outline is likely under 3:1 ([use of colour](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html), [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)). Honour `prefers-reduced-motion` with `highlightOnComplete: false` and zeroed fade durations; do not lean on haptics (`navigator.vibrate` is unsupported in iOS Safari), and any audio cue needs a mute ([reduced motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)).

## Design options this opens

These are decision options, not recommendations already made.

**A. Canvas scaffold posture.** (1) Keep the permanent blank canvas; (2) faint outline with a learner toggle, as Hanzi Writer/maobi default; (3) outline first, then blank, as Tofu does; (4) blank with a Skritter-style Reveal; (5) blank with a first-stroke ghost.

**B. Hint policy.** (1) None, as today; (2) learner-invoked graded ladder (outline → first-stroke ghost → full ghost); (3) automatic after N misses, the library default. Decide separately whether a hint degrades the outcome.

**C. Feedback timing and rubric.** (1) Per-stroke auto-grade, as today; (2) end-of-character self-grade after reveal; (3) objective floor plus self-grade band. Decide binary zero-mistake versus three-tier pass/partial/fail.

**D. SRS mapping.** (1) Any imperfection maps to Again, as today; (2) Again only for genuine recall failure, correct-but-sloppy at most Hard; (3) decide whether reveal or skip counts as a lapse.

**E. Word-level flow.** (1) Keep per-character flow (the library constraint); (2) add a word-level progress cue; (3) run one canvas per word, which needs host-side orchestration.

**F. Input and accessibility posture.** (1) Keep legacy touch-only input; (2) add a pointer-events/stylus path; (3) grow the target under coarse pointers; (4) add a keyboard/AT equivalent. These can be combined.

**G. Failure and retry path.** (1) No retry, as today; (2) retry after reveal; (3) skip with an explicit penalty; (4) allow undo/clear within an attempt.

## Contested or thin evidence

- No experimental dose-response for an error-tolerance threshold was found; only official rubrics exist.
- One recent study found an animated motor sequence reduced reproduction accuracy for medium/high-complexity characters, with novices — a single study ([Zhang, Wang & Dai 2026](https://link.springer.com/article/10.1007/s11145-026-10837-x)).
- Feedback timing and stroke-order effects are genuinely contested; order effects are null-to-modest rather than settled.
- Self-grade leniency is robust, but the exact width of a self-grade band is untested.
- hanzi-writer's `averageDistanceThreshold` is undocumented, and its internal thresholds are not empirically validated for adult learners.
- "150px is cramped" is a usability estimate, not a WCAG violation; the fingertip-coverage figure is approximate.
- The community claims below are anecdotal, not evidence of learning outcomes.

## Community sources

- `author`: mikelove (Pleco staff)
  `venue`: discourse
  `date`: 2013-05-15
  `permalink`: https://www.plecoforums.com/threads/rigorous-handwriting-testing-in-flashcards.3660/
  Claim summary: Pleco views its handwriting test as more of a visual recall test than writing practice.
- `author`: josh (Skritter staff)
  `venue`: discourse
  `date`: 2019-11-12
  `permalink`: https://forum.skritter.com/t/a-very-serious-issue-with-all-android-versions-and-maybe-other-platforms/3410
  Claim summary: Prefers lenient auto-grading plus self-correction over strict false negatives.
- `author`: anonymous
  `venue`: discourse
  `date`: 2018-11-30
  `permalink`: https://www.chinese-forums.com/forums/topic/53507-tofu-learn-for-learning-hanzi/page/3/
  Claim summary: Intentionally skips the last stroke and presses "I don't know" to keep a character out of the review bank.

## Primary sources

- https://chanind.github.io/hanzi-writer/docs.html
- https://github.com/chanind/hanzi-writer
- https://github.com/chanind/hanzi-writer/releases
- https://docs.skritter.com/article/199-study-screen-overview
- https://docs.skritter.com/article/267-mobile-writing-canvas-and-study-screen-buttons
- https://docs.skritter.com/article/281-writing-modes
- https://ios.skritter.com/faq
- https://blog.skritter.com/2008/10/control-thy-strictness/
- https://blog.skritter.com/2014/07/improve-your-character-writing-by-enabling-raw-squigs/
- https://blog.skritter.com/2021/03/the-ultimate-guide-to-chinese-character-stroke-order/
- https://www.tofulearn.com/chinese
- https://www.pleco.com/manual/android/flash/
- https://github.com/jcklie/anki-maobi
- https://ankiweb.net/shared/info/959635611
- https://bpb-us-e2.wpmucdn.com/sites.wustl.edu/dist/8/805/files/2026/06/Roediger-and-Butler-2011-The-critical-role-of-retrieval-practice-in-long-term-retention.pdf
- https://bjorklab.psych.ucla.edu/wp-content/uploads/sites/13/2016/07/Kornell_Hays_Bjork_2009_JEP-LMC.pdf
- https://scholar.lib.ntnu.edu.tw/en/publications/effect-of-stroke-order-learning-and-handwriting-exercises-on-reco-2/
- https://www.tandfonline.com/doi/full/10.1080/09588221.2024.2443769
- https://repository.um.edu.mo/bitstream/10692/39642/1/2021%20Lyu%2C%20Lai%2C%20Lin%2C%20%26%20Gong%202021.pdf
- https://school.tc.edu.tw/open-message/064611/get-file/5ec736fb8aeb013804703550
- https://doi.org/10.1080/09541440701326022
- https://github.com/open-spaced-repetition/fsrs4anki/blob/main/docs/tutorial.md
- https://docs.ankiweb.net/manual/deck-options
- https://expertium.github.io/Algorithm.html
- https://pact.cs.cmu.edu/pubs/Koedinger%20Aleven%2007.pdf
- https://pact.cs.cmu.edu/koedinger/pubs/Roll,%20Aleven,%20McLaren%20&%20Koedinger%202007.pdf
- https://bjorklab.psych.ucla.edu/wp-content/uploads/sites/13/2016/11/Making-Things-Hard-on-Yourself-but-in-a-Good-Way-20111.pdf
- https://link.springer.com/article/10.1007/s11145-026-10837-x
- https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html
- https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
- https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html
- https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html
- https://developer.mozilla.org/en-US/docs/Web/CSS/touch-action
- https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events
- https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
- https://web.dev/articles/accessible-tap-targets
- https://webkit.org/blog/5610/more-responsive-tapping-on-ios/
