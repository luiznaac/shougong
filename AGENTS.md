# AGENTS.md — shougong monorepo

Two projects, one repo:

- **`backend/`** — the FastAPI hexagonal service. All backend commands run from
  `backend/` (`cd backend && uv run poe <task>`). Its architecture, conventions and
  the rules for evolving it are in [backend/AGENTS.md](backend/AGENTS.md) — read that
  before touching `backend/`.
- **`frontend/`** — the React/Vite SPA. Commands run from `frontend/`
  (`npm --prefix frontend run <script>`). Details in
  [frontend/README.md](frontend/README.md).

## The one cross-cutting rule

`frontend/src/api/types.ts` is a hand-maintained mirror of
`backend/src/shougong/httpapi/schema.py`. Any change to a response/request DTO on
one side must update the other in the same commit.

## Git workflow

**AI agents: never commit directly to `master`.** Always create a feature branch and open a PR,
even for a small or "obviously safe" change.

## Tooling

Root `package.json` holds script shims only (`npm run be:check`, `npm run fe:build`,
`npm run check`, `npm run db`, `npm run db:migrate`, `npm run db:generate`, `npm run up`). It has
no dependencies and is not a real package. `.pre-commit-config.yaml` lives at the root and scopes
hooks by path (`^backend/`, `^frontend/`), and carries `no-commit-to-branch` — the "never commit
directly to master" rule above is enforced there, not merely stated.

## Docker

One image (repo-root `Dockerfile`, multi-stage) ships backend + frontend together:
`supervisord` runs `uvicorn` (API, `API_PORT`/8080) and `nginx` (`deploy/nginx.conf.template`
— serves the built SPA on `WEB_PORT`/8081 and reverse-proxies `/api` → uvicorn). No DB in
the image. `docker-compose.yml` at the root adds MySQL for full-stack / DB-only local runs.
The schema comes from `backend/alembic/versions/*.py`, applied by `python scripts/migrate.py`
from `deploy/entrypoint.sh` before the app starts — see [backend/AGENTS.md](backend/AGENTS.md)
§3.5.
The `publish` job in `.github/workflows/ci.yml` (`needs: [backend, frontend]`, push-to-master
only) pushes `luiznaac/shougong:latest` + `:v<run-number>` (a sequential build number,
`github.run_number`) — only after a green CI run.
