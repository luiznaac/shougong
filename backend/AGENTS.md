# AGENTS.md — shougong backend

FastAPI hexagonal service for the Chinese-handwriting SRS. Deep architecture, component inventory,
request-flow diagrams, and configuration reference live in [`../docs/02-architecture.md`](../docs/02-architecture.md)
— read that before a non-trivial change, this file only covers what an agent needs on every task.

## Map

```
src/shougong/
  usecase/        domain — dictionary, study (SRS), strokes, reading, commons. No fastapi/
                  sqlalchemy/httpx/pydantic/fsrs/jieba imports here (import-linter enforced).
  persistence/    SQLAlchemy 2 async repos, one sub-package per usecase slice
  gateway/        outbound httpx: CC-CEDICT, HSK dataset, Hanzi Writer, LiteLLM (reading gen)
  srs/            FSRS adapter (fsrs_engine.py) — implements ISrsEngine
  segmentation/   jieba adapter (jieba_segmenter.py, jieba_pos.py) — implements ISegmenter
  httpapi/        FastAPI controllers + Pydantic DTOs (schema.py)
  application/    composition root: settings.py, container.py, boot.py
```

No DI framework — `application/container.py` is the one place that knows every concrete class.
Adding a checker/endpoint = write the class, add one line to `container.py`. See
[`../docs/02-architecture.md`](../docs/02-architecture.md) for the full component table and the
add-study-item / grade-a-review sequence diagrams.

## Commands

```bash
uv run poe check              # lint + format-check + mypy --strict + contracts + unit tests — run this
uv run poe test               # + integration tests (Testcontainers MySQL, slower — CI runs this)
uv run poe run                # dev server, :8080, --reload
uv run poe migrate:generate -- --autogenerate -m "add_something"
uv run poe migrate            # apply pending migrations locally
```

## Hard rules

- **`usecase/` stays pure.** No `fastapi`/`sqlalchemy`/`httpx`/`pydantic`/`fsrs`/`jieba` imports —
  `import-linter` (`uv run poe contracts`) fails the build on violation, not just a convention.
- **Every adapter explicitly inherits its port** (`class FsrsEngine(ISrsEngine):`), even though
  `Protocol` makes it structurally optional — this is what lets mypy and the IDE jump port↔impl.
- **`gateway/reading/system_prompt.txt` is product behavior, not config.** It's the LLM prompt
  that shapes every generated reading text — changing it changes what learners see, review it like
  you would a usecase change, not a copy edit.
- **DB migrations**: Alembic autogenerate + review, never hand-write SQL or add to
  `mysql/init.sql` (doesn't exist) — see [`../docs/02-architecture.md`](../docs/02-architecture.md)
  for the baseline/`compare_metadata` guard mechanics, same shape as the Kotlin repos' Flyway setup
  (see salgadinhos' `python-db-migration` skill).
- **`frontend/src/api/types.ts` mirrors `httpapi/schema.py`** — update both in the same commit
  (see root [`AGENTS.md`](../AGENTS.md)).

## Stack pitfalls

- Domain models are `@dataclass(frozen=True, slots=True)` — Pydantic only in `httpapi/schema.py`
  and `application/settings.py`.
- Time comes from `IClock`, never `datetime.now()` directly in `usecase`/`persistence` logic.
- A health check never raises — catch `Exception`, return `is_healthy=False`.
- See salgadinhos' `python-hexagonal-feature` and `exposed-v1`-equivalent stack skills for the
  walkthrough shape shared with the `environments/python` scaffold this was generated from.

## Read when…

- Adding/changing a reading-generation feature or the LLM prompt → [`../docs/05-reading-engine.md`](../docs/05-reading-engine.md).
- Changing the data model or writing a migration → [`../docs/03-data-model.md`](../docs/03-data-model.md).
- Adding or changing an HTTP endpoint → [`../docs/04-api.md`](../docs/04-api.md), and check [`../docs/07-api-gaps.md`](../docs/07-api-gaps.md) for known-missing endpoints before assuming one doesn't exist for a reason.
- Anything touching SRS scheduling/FSRS → `../docs/02-architecture.md`'s "grade a review" sequence
  diagram, then `srs/fsrs_engine.py` directly.

## Git

**Do not commit directly to `master`.** Always create a feature branch and open a PR, even for a
small or "obviously safe" change. This applies to all contributors.
