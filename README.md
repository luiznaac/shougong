# shougong (手工)

Monorepo for the Chinese handwriting SRS.

| Path         | What                                                                        |
| ------------ | -------------------------------------------------------------------------- |
| [`backend/`](backend/)   | FastAPI + hexagonal service (uv, SQLAlchemy/MySQL, FSRS). See [backend/README.md](backend/README.md) and [backend/CLAUDE.md](backend/CLAUDE.md). |
| [`frontend/`](frontend/) | React + Vite SPA — the inverted-review handwriting trainer. See [frontend/README.md](frontend/README.md). |

The frontend's `src/api/types.ts` mirrors the backend's `httpapi/schema.py`; keep
them in sync in the same change — that's the reason these two live in one repo.

## Dev

```bash
npm run setup      # npm install in frontend/ + uv sync in backend/
npm run db         # start MySQL (docker) for the backend
```

Then, in two shells:

```bash
npm run be:run     # backend  -> http://localhost:8080
npm run fe:dev     # frontend -> http://localhost:5273  (proxies /api -> :8080)
```

## Docker

One image holds both processes — `uvicorn` (API) and `nginx` (the built SPA,
which also reverse-proxies `/api` to uvicorn) — supervised by `supervisord`, on
separate ports. The database is **not** in the image.

```bash
docker compose up --build     # app + MySQL, full stack
#   UI   -> http://localhost:8081
#   API  -> http://localhost:8080
docker compose up -d mysql    # just the DB, for local `cd backend && uv run poe run`
```

Ports are configurable with `API_PORT` / `WEB_PORT`. For a standalone run against
an external database:

```bash
docker run --rm -p 8080:8080 -p 8081:8081 \
  -e MYSQL__HOST=host.docker.internal -e MYSQL__DATABASE=shougong \
  -e MYSQL__USER=root -e MYSQL__PASSWORD= \
  luiznaac/shougong:latest
```

**Publishing:** every push to `master` that touches `backend/`, `frontend/`,
`Dockerfile`, or `deploy/` builds and pushes `luiznaac/shougong:latest` and
`:sha-<short>` to Docker Hub (`.github/workflows/docker-publish.yml`). Needs repo
secrets `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`.

## Checks

```bash
npm run check      # backend `poe check` + frontend typecheck + build
```

CI (`.github/workflows/ci.yml`) runs the backend and frontend jobs independently.

`package.json` at the repo root is only a script shim (no dependencies) — the real
toolchains are `uv` in `backend/` and `npm` in `frontend/`.
