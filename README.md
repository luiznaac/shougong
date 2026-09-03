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

## Checks

```bash
npm run check      # backend `poe check` + frontend typecheck + build
```

CI (`.github/workflows/ci.yml`) runs the backend and frontend jobs independently.

`package.json` at the repo root is only a script shim (no dependencies) — the real
toolchains are `uv` in `backend/` and `npm` in `frontend/`.
