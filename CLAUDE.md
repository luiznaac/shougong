# CLAUDE.md — shougong monorepo

Two projects, one repo:

- **`backend/`** — the FastAPI hexagonal service. All backend commands run from
  `backend/` (`cd backend && uv run poe <task>`). Its architecture, conventions and
  the rules for evolving it are in [backend/CLAUDE.md](backend/CLAUDE.md) — read that
  before touching `backend/`.
- **`frontend/`** — the React/Vite SPA. Commands run from `frontend/`
  (`npm --prefix frontend run <script>`). Details in
  [frontend/README.md](frontend/README.md).

## The one cross-cutting rule

`frontend/src/api/types.ts` is a hand-maintained mirror of
`backend/src/shougong/httpapi/schema.py`. Any change to a response/request DTO on
one side must update the other in the same commit.

## Tooling

Root `package.json` holds script shims only (`npm run be:check`, `npm run fe:build`,
`npm run check`, `npm run db`, `npm run up`). It has no dependencies and is not a real
package. `.pre-commit-config.yaml` lives at the root and scopes hooks by path
(`^backend/`, `^frontend/`).

## Docker

One image (repo-root `Dockerfile`, multi-stage) ships backend + frontend together:
`supervisord` runs `uvicorn` (API, `API_PORT`/8080) and `nginx` (`deploy/nginx.conf.template`
— serves the built SPA on `WEB_PORT`/8081 and reverse-proxies `/api` → uvicorn). No DB in
the image. `docker-compose.yml` at the root adds MySQL for full-stack / DB-only local runs.
`.github/workflows/docker-publish.yml` pushes `luiznaac/shougong:latest` + `:sha-<short>`
on master pushes that touch `backend/`, `frontend/`, `Dockerfile`, or `deploy/`.
