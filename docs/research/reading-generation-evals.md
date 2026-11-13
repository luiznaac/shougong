---
source: research brief — whether evals are worth adding to the reading-generation feature, and which ones
branch: research/reading-generation-evals
date: 2026-11-13
---

# Reading generation: are evals worth it?

## Short answer

Yes — a small, targeted eval set is worth it, but not a benchmark suite. The feature already has the strongest kind of check: a deterministic, task-specific gate (`out_of_vocabulary` in `backend/src/shougong/usecase/reading/validation.py`) that rejects a draft above `max_extra_words` and retries. Generic Chinese/knowledge benchmarks measure the model, not this feature. The eval's job is narrower and still valuable: make model/prompt/effort changes decidable, and catch quality regressions the vocabulary gate cannot see.

OpenAI's own guidance frames the same point: evals are "an essential component to building reliable applications", "especially when upgrading or trying new models" (OpenAI, *Working with evals*).

## What the deterministic gate already covers

- Distinct out-of-vocabulary words, whole-word matching against the known set (so 人工 is not excused by 人 + 工).
- The correction loop's convergence: `attempts` stores each draft's `extra_words`, tokens and `chosen` flag per reading, so acceptance rate and attempts-to-accept are already recorded.
- Dialogue structure (`check_dialogue`): speaker validity and turn/text consistency.
- Token usage per attempt (`prompt_tokens`, `completion_tokens`).

That is an IFEval-shaped design: the constraint is *verifiable*, which is exactly what the instruction-following literature recommends over judge-based scoring when a constraint can be checked mechanically (Zhou et al., *IFEval*, arXiv 2311.07911).

## Where an eval earns its keep

1. **Model swap.** The concrete decision already on the table is DeepSeek V4.1 Flash vs GLM-5.3-Flash vs Kimi/MiniMax/Qwen. The gate tells you pass/fail on vocabulary; it does not tell you which model produces more natural, coherent, level-appropriate prose per unit of latency and cost.
2. **Prompt and effort changes.** `reasoning_effort` is load-bearing: measured on this task, `none` is ~4 s but 29–40 out-of-vocabulary words (fails), `minimal` 15–33 s with 9–20 (fails), `low` 86–246 s within budget. Any prompt or effort edit can silently move that trade-off.
3. **Working-set construction.** What goes into `known_words` / `must_use` changes difficulty; a fixed golden set makes the effect measurable.
4. **Correction-loop policy.** `max_attempts` and `max_extra_words` are product knobs; an eval shows whether a second attempt actually recovers a rejected draft or just burns four more minutes.
5. **Quality the gate cannot see.** Naturalness, grammar, semantic coherence, topic adherence, level fit (not just "in vocabulary" but "appropriate"), and leakage (pinyin, translation, Latin text, repeated sentences).

## Recommended evals, in order of value per unit of effort

### Tier 0 — SQL over stored attempts (do this first, no new code)

Every generation already stores its attempts. Aggregate the existing rows: distribution of `extra_words` per chosen attempt, attempts-to-accept, prompt/completion tokens, and per-model latency. This is a free baseline and the fixture source for Tier 1. It also answers "is the current model good enough?" without spending a token.

### Tier 1 — golden-set regression eval (deterministic, offline)

- 40–60 cases sampled from real rows: `format`, `max_extra_words`, `must_use`, `working_set`, `topic` (including null), and the known-word set. Store as JSONL under `backend/evals/`.
- Run each case once through the real gateway with `max_attempts=1` (measure first-shot quality; test the loop separately), fixed `reasoning_effort`, fixed model id.
- Deterministic assertions: valid tool call, non-empty text, `len(extras) <= max_extra_words`, dialogue checks, no Latin/pinyin characters, no sentence repeated more than twice, length within a sane band. Record latency and tokens.
- Run it as a pytest module marked `evals`, skipped unless `RUN_EVALS=1`, writing a JSON report. No new dependency; reuse `out_of_vocabulary`, `check_dialogue`, `JiebaSegmenter`.
- **Do not put it in CI.** At ~0.008 USD and ~100–245 s per case, a 50-case run is ~0.40 USD but 1.5–3.5 hours serial. Run it nightly or on model/prompt changes, parallelised by a few workers; keep the normal CI on the deterministic unit/integration suites.

### Tier 2 — quality scoring (judge, calibrated)

- Rubric per output: fluency/naturalness, grammaticality, coherence, topic adherence, level fit. Score 1–5 per axis, plus a pairwise preference against the incumbent for model swaps.
- Use an LLM judge from a *different* model family than the generator, and calibrate it on ~30 human-labelled outputs before trusting it. The judge literature reports strong agreement with humans (>80% for strong judges) but documents position, verbosity and self-enhancement biases (Zheng et al., *Judging LLM-as-a-Judge*, arXiv 2306.05685) — randomise order, fix the rubric, and prefer pairwise over absolute scores when comparing models.
- Judge in Chinese with a model that is strong in Chinese; otherwise the judge becomes the weakest link.

### Tier 3 — robustness and safety

- The `topic` field is free text sent verbatim to the model: test adversarial topics ("ignore your instructions and …", max length, emoji, empty/whitespace), asserting a valid reading and no instruction leakage.
- Malformed/truncated tool calls, empty text, and timeout behaviour (already unit-tested at the gateway; keep those as unit tests, not evals).

## What is not worth it

- **C-Eval / CMMLU / MMLU-style suites.** They measure multi-discipline knowledge through multiple-choice questions (C-Eval: 52 disciplines, four difficulty levels — arXiv 2305.08322). They say nothing about whether a text stays inside an HSK word list.
- **BLEU/SARI against a single reference.** There is no single correct text; the target is a constraint, not similarity to a reference. SARI belongs to simplification with sentence-aligned references, which this feature does not have.
- **Full human evaluation at scale.** Calibrating a judge on a small human sample is the affordable version.
- **Judge or live-model evals on every commit.** Slow, costly, flaky.
- **Building on the OpenAI Evals platform.** It is being retired: read-only for existing users on 2026-10-31 and scheduled to shut down on 2026-11-30 (OpenAI deprecations). A pytest + JSONL harness has no such lifecycle.

## Cost and time budget (measured on this feature)

| item | value |
|---|---|
| one generation, DeepSeek V4.1 Flash off-peak | ~1.7k prompt + ~13k completion ≈ 0.008 USD |
| one generation, wall clock at `low` | 86–246 s |
| 50-case run, 1 attempt each | ~0.40 USD, 1.5–3.5 h serial |
| 3 runs per case (flakiness) | ~1.20 USD, 4.5–10 h serial |

Conclusion: evals are cheap in money and expensive in time. That is the argument for a small golden set, a nightly/on-change cadence, and `max_attempts=1` in the harness.

## Sources (primary)

- OpenAI, *Working with evals* (purpose, dataset + graders, deprecation timeline): https://platform.openai.com/docs/guides/evals
- IFEval — verifiable instructions: https://arxiv.org/abs/2311.07911
- C-Eval — what a Chinese benchmark actually measures: https://arxiv.org/abs/2305.08322
- LLM-as-a-judge — agreement and biases: https://arxiv.org/abs/2306.05685

## Community sources

None. Claims are from first-party documentation, papers, or measurements taken on this feature.
