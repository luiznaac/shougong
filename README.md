# shougong (手工)

Monorepo for the Chinese handwriting SRS.

| Path         | What                                                                        |
| ------------ | -------------------------------------------------------------------------- |
| [`backend/`](backend/)   | FastAPI + hexagonal service (uv, SQLAlchemy/MySQL, FSRS). See [backend/README.md](backend/README.md) and [backend/AGENTS.md](backend/AGENTS.md). |
| [`frontend/`](frontend/) | React + Vite SPA — the inverted-review handwriting trainer. See [frontend/README.md](frontend/README.md). |

The frontend's `src/api/types.ts` mirrors the backend's `httpapi/schema.py`; keep them in sync in the same change — that's the reason these two live in one repo.

## Documentation

`docs/` holds the business overview, technical architecture, data model, API reference, reading-engine explainer, desktop UI/UX proposal, and a backlog of proposed endpoints. Start at [docs/README.md](docs/README.md).

## Dev

```bash
npm run setup      # npm install in frontend/ + uv sync in backend/
npm run db         # start MySQL (docker) for the backend
```

Then, in two shells:

```bash
npm run be:run     # backend  -> http://localhost:8130
npm run fe:dev     # frontend -> http://localhost:8133  (proxies /api -> :8130)
```

## Ports

Local host ports are shougong's assigned block, recorded in [`.salgadinhos/ports.json`](.salgadinhos/ports.json). Only the published side of a compose mapping varies — container-internal ports stay fixed.

| Role | Host port | Env key | Container-internal |
| --- | --- | --- | --- |
| `api` | `8130` | `HTTP_PORT` | `8080` (`API_PORT`) |
| `web` (combined image: SPA + `/api` proxy) | `8131` | `WEB_HOST_PORT` | `8081` (`WEB_PORT`) |
| `mysql` | `8132` | `MYSQL__PORT` | `3306` |
| `frontend-dev` (Vite) | `8133` | `FRONTEND_DEV_PORT` | — |

A gitignored `.env` may override a host port locally; the committed defaults above apply to a fresh clone. The block is dev-only: a non-dev `APP_ENV` (and the published image) keeps the canonical `8080`/`3306` unless a port is set explicitly, so deploys reach a local MySQL on `3306`. The DB port recipe is `docker compose port mysql 3306`.

## Docker

One image holds both processes — `uvicorn` (API) and `nginx` (the built SPA, which also reverse-proxies `/api` to uvicorn) — supervised by `supervisord`, on separate ports. The database is **not** in the image.

The app runs as `APP_ENV=prod`, so it requires an OTLP endpoint: export
`OTEL_EXPORTER_OTLP_ENDPOINT` (for a Collector on the host,
`http://host.docker.internal:4318`). Without it the app's boot fails loudly;
the `mysql` service alone still starts.

```bash
export OTEL_EXPORTER_OTLP_ENDPOINT=http://host.docker.internal:4318
docker compose up --build     # app + MySQL, full stack
#   UI   -> http://localhost:8131
#   API  -> http://localhost:8130
docker compose up -d mysql    # just the DB (host :8132), for local `cd backend && uv run poe run`
```

The published ports are configurable with `HTTP_PORT` / `WEB_HOST_PORT`; inside the container the app still listens on `API_PORT=8080` and nginx on `WEB_PORT=8081`. For a standalone run against an external database:

```bash
docker run --rm -p 8130:8080 -p 8131:8081 \
  -e MYSQL__HOST=host.docker.internal -e MYSQL__PORT=3306 -e MYSQL__DATABASE=shougong \
  -e MYSQL__USER=root -e MYSQL__PASSWORD= \
  luiznaac/shougong:latest
```

**Publishing:** after CI passes on a push to `master`, the `publish` job in `.github/workflows/ci.yml` builds and pushes `luiznaac/shougong:latest` and `:v<run-number>` (a sequential build number) to Docker Hub. Needs repo secrets `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`.

## Checks

```bash
npm run check      # backend `poe check` + frontend typecheck + build
```

CI (`.github/workflows/ci.yml`) runs the backend and frontend jobs independently, then a `publish` job (master pushes only) that gates the Docker image on both.

`package.json` at the repo root is only a script shim (no dependencies) — the real toolchains are `uv` in `backend/` and `npm` in `frontend/`.
