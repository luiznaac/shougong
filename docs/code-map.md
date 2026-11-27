# Code map

Monorepo navigation: the two lanes, the seam between them, and the root entry points. Each lane owns its exhaustive module map — [backend](../backend/docs/code-map.md), [frontend](../frontend/docs/code-map.md) — so this page is the index and never restates them.

Vocabulary: **module**, **interface**, **seam**, **adapter**.

## Lanes

| Lane | Shape | Module map |
| --- | --- | --- |
| `backend/` | FastAPI hexagonal service: `application → (httpapi \| persistence \| gateway \| srs \| segmentation \| randomization) → usecase`. | [Backend code map](../backend/docs/code-map.md) |
| `frontend/` | React + Vite SPA: `api/ → components/ → pages/ → lib/`, with `i18n/` for backend-enum labels. | [Frontend code map](../frontend/docs/code-map.md) |

## Cross-lane seam

`frontend/src/api/types.ts` is a hand-maintained mirror of `backend/src/shougong/httpapi/schema.py`. Any request/response DTO change updates both in the same commit — the reason the two lanes share one repo.

## Entry points

- `backend/src/shougong/application/boot.py` — `app` (what uvicorn imports) and `main()` (`poe run`), serving on `HTTP_PORT`.
- `backend/src/shougong/application/container.py` — the composition root: builds the object graph, controllers and FastAPI app.
- `backend/src/shougong/httpapi/configuration/server.py` — `build_app(...)`: mounts every controller and installs the exception handlers.
- `backend/scripts/migrate.py` and `backend/alembic/env.py` — the migration entry and Alembic environment.
- `frontend/src/main.tsx` — the SPA bootstrap.
- `frontend/src/App.tsx` — the route tree, including the chrome-less lesson/review/practice flows.
- `frontend/vite.config.ts` — dev server port, `/api` proxy target and production base path.
- `package.json` (root) — the script shims every command in the README runs.
- `docker-compose.yml`, `Dockerfile`, `deploy/` — the local stack and the combined production image.
- `scripts/release.sh` — cut a release: validate the repository state, then create the `v*` tag and GitHub Release, which fires `.github/workflows/docker-publish.yml`.
