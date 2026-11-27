# AGENTS.md — shougong monorepo

Two projects, one repo:

- **`backend/`** — the FastAPI hexagonal service. All backend commands run from `backend/` (`cd backend && uv run poe <task>`). Its architecture, conventions and the rules for evolving it are in [backend/AGENTS.md](backend/AGENTS.md) — read that before touching `backend/`.
- **`frontend/`** — the React/Vite SPA. Commands run from `frontend/` (`npm --prefix frontend run <script>`). Details in [frontend/AGENTS.md](frontend/AGENTS.md) and the [frontend code map](frontend/docs/code-map.md).

## Code map

- [Monorepo code map](docs/code-map.md)
- [Backend code map](backend/docs/code-map.md)
- [Frontend code map](frontend/docs/code-map.md)

## Documentation

- [Family repository documentation standard](https://github.com/luiznaac/salgadinhos/blob/master/docs/salgadinhos/documentation-standard.md)
- [`refresh-docs` skill](https://github.com/luiznaac/salgadinhos/blob/master/skills/refresh-docs/SKILL.md)
- Run `refresh-docs audit` on this repo when a change hits the standard's change-kind matrix.

## The one cross-cutting rule

`frontend/src/api/types.ts` is a hand-maintained mirror of `backend/src/shougong/httpapi/schema.py`. Any change to a response/request DTO on one side must update the other in the same commit.

## Tooling

Root `package.json` holds script shims only (`npm run be:check`, `npm run fe:build`, `npm run check`, `npm run db`, `npm run db:migrate`, `npm run db:generate`, `npm run up`). It has no dependencies and is not a real package. `.pre-commit-config.yaml` lives at the root and scopes hooks by path (`^backend/`, `^frontend/`), and carries `no-commit-to-branch` — the git/PR conventions are enforced there, not merely stated (see `salgadinhos/global/AGENTS.md`).

## Config & secrets

All backend config is env vars (`pydantic-settings`, nested keys with `__`); the reference is in [docs/02-architecture.md](docs/02-architecture.md) §Configuration, and the versioned [backend/.env.example](backend/.env.example) records the env vars and their dev fixtures. Copy it to `backend/.env` (gitignored) — pydantic-settings loads that file for `cd backend && uv run poe run`. `docker compose up` reads the gitignored repo-root `.env` instead, for the `GATEWAYS_AI_*` values it substitutes into `docker-compose.yml`.

No real secret value is committed or defaulted in code: `MYSQL__PASSWORD` and `GATEWAYS__AI__API_KEY` default to empty, and there is no `dev-*` token yet because shougong registers no app-Bearer in code. The single secrets doc is `docs/salgadinhos/secrets.md` in the salgadinhos repo.

## Docker

One image (repo-root `Dockerfile`, multi-stage) ships backend + frontend together: `supervisord` runs `uvicorn` (API, `API_PORT`/8080) and `nginx` (`deploy/nginx.conf.template` — serves the built SPA on `WEB_PORT`/8081 and reverse-proxies `/api` → uvicorn). Those container-internal ports are fixed, and the image pins `MYSQL__PORT=3306` for its external database. No DB in the image. `docker-compose.yml` at the root adds MySQL for full-stack / DB-only local runs, publishing the host side on shougong's assigned block — `api` 8130, `web` 8131, `mysql` 8132 — recorded in [`.salgadinhos/ports.json`](.salgadinhos/ports.json) and listed in [README.md](README.md#quickstart); the Vite dev server uses `frontend-dev` 8133, and the acceptance runbook's dev-only HanziHero stub uses `hanziHeroStub` 8134. The schema comes from `backend/alembic/versions/*.py`, applied by `python scripts/migrate.py` from `deploy/entrypoint.sh` before the app starts — see [backend/AGENTS.md](backend/AGENTS.md) §3.5. `.github/workflows/docker-publish.yml` publishes `luiznaac/shougong` only on a deliberate `v*` release tag — immutable semver, major.minor and short-SHA tags, with `latest` moving only on a release — and builds the same image with `push: false` on pull requests, so a merge to `master` never publishes. Releases are cut with `scripts/release.sh <version>`; the curated history lives in [`CHANGELOG.md`](CHANGELOG.md).

## Acceptance

Surfaces: **HTTP + Browser** — the FastAPI service and the React SPA.

Run story: the local dev stack — MySQL in Docker, then the backend, then the Vite dev server.

Runbook: [`docs/runbooks/acceptance.md`](docs/runbooks/acceptance.md) — boot commands, readiness probes, env and teardown, and the fold-aware visual rule. Browser `start_url`: `http://localhost:8133/`.
