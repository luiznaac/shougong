# shougong (手工)

A backend for learning to hand-write Chinese characters with a spaced-repetition system
(FSRS, via [`py-fsrs`](https://pypi.org/project/fsrs/)). Built on a layered hexagonal
architecture: FastAPI HTTP layer, a hand-written composition root instead of a DI framework,
async database access (SQLAlchemy 2 / MySQL), outbound HTTP (httpx), Docker, Ruff, mypy
`--strict`, import-linter, and a Testcontainers integration harness.

Three things it does: look up characters in a dictionary, enqueue entries as study items, and
run the review loop — grade a due item `again | hard | good | easy` and FSRS reschedules it.

## Quick start

```bash
uv sync                       # create .venv + install everything
docker compose up -d mysql    # local MySQL on :3306 (managed separately from the app)
uv run poe run                # start the service on http://localhost:8080
curl localhost:8080/health
```

## Run in Docker

**Whole stack (app + MySQL)** — builds the image and starts everything:

```bash
docker compose -f docker-compose.full.yml up --build
```

**App only** — the image never contains the database; point it at an external MySQL:

```bash
docker build -t shougong .
docker run --rm -p 8080:8080 \
  -e MYSQL__HOST=host.docker.internal \
  -e MYSQL__DATABASE=shougong \
  -e MYSQL__USER=root -e MYSQL__PASSWORD= \
  shougong
```

`docker-compose.yml` stays as a **DB-only** helper for local dev (`docker compose up -d mysql`
while you run the app with `uv run poe run`).

All config is via env vars (`APP_ENV`, `HTTP_PORT`, `LOG_LEVEL`, `MYSQL__*`,
`GATEWAYS__APP__HOST`, `DICTIONARY_AUTOLOAD`, `STUDY_TIMEZONE`) — see `.env.example`.
Nested keys use `__`.

`STUDY_TIMEZONE` (an IANA name like `America/Sao_Paulo`, default `UTC`) sets the SRS day
boundary: every card's due time is rounded down to that timezone's midnight, so a whole day's
cards become due at once instead of trickling in through the day.

## The review loop

`GET /study-items?due=true` is the queue to practise now. For each item, `POST
/study-items/{id}/reviews` with `{"rating": "again|hard|good|easy"}` hands the grade to FSRS,
which advances the card and pushes `due` out (snapped to the day boundary). The item drops out
of the due list until then, and reviewing it again before it comes due is rejected with `409`.
`GET /study-items/{id}/reviews` returns the grade history, newest first.
`GET /study-items/{id}/history` returns the study item's history, newest first — a row saved when
the item is created and after every change, each with its own `created_at`.
`GET /study-items/history/learning-to-review` returns, across every study item, the single history
row that moved it from learning into review (a card graduates once its first review lands), newest
first and paginated with `limit` / `offset`.

## API collection

`postman/shougong.postman_collection.json` — a Postman collection covering every endpoint.
Import it and set the `baseUrl` variable.

## Tasks (`uv run poe <task>`)

| task               | what it does                                            |
|--------------------|--------------------------------------------------------|
| `run`              | uvicorn with reload                                     |
| `lint` / `format`  | Ruff                                                    |
| `typecheck`        | mypy `--strict`                                         |
| `contracts`        | import-linter (layer rules)                             |
| `test`             | all tests                                               |
| `test-unit`        | unit tests only (no Docker)                             |
| `test-integration` | integration tests (needs a Docker daemon)              |
| `check`            | everything CI runs                                      |

## The dictionary

On startup the app downloads [CC-CEDICT](https://www.mdbg.net/chinese/dictionary?page=cc-cedict)
(licensed CC BY-SA 4.0) from MDBG and fills `dictionary_entry` — **once**, only when the table
is empty. It runs in the background, so search results appear a few seconds after boot.

Set `DICTIONARY_AUTOLOAD=false` to disable it. To force a refresh, clear the table
(`TRUNCATE dictionary_entry`) and restart. Traditional forms are ignored — this trainer only
drills simplified handwriting.

See [CLAUDE.md](CLAUDE.md) for the architecture and the rules for evolving it.
