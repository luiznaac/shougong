# Acceptance runbook — shougong

Bootstrap-only runbook for the `self-served-acceptance` runner: one section per service, in start order. The runner owns the browser process; there is deliberately no browser section here.

### Setup prose

- **Clean-checkout prerequisites**: Docker with a reachable daemon, `uv` (the backend's toolchain), and Node 22 + npm. No other host state is touched.
- **Schema**: the `backend` section applies the schema before serving; the app does not migrate itself outside the container entrypoint. MySQL starts empty, so the Alembic migration is the only seed.
- **Env fixtures**: every backend setting has a dev default, so no `backend/.env` is required for a bare boot. Copy `backend/.env.example` to the gitignored `backend/.env` only to override a default. No secret is needed: MySQL runs as `root` with an empty password, and the AI gateway is not booted.
- **Dictionary / HSK autoload is off** in the `backend` section. Both downloads are background, non-fatal startup tasks, but they need network and pay a large first-boot cost. With them off the dictionary and HSK tables stay empty — there are no dictionary/HSK fixtures yet, so intents that need that data are unreachable and should be declared as a known gap. Turn both back on for a dictionary-reading intent once a fixture exists.
- **Reading generation** needs the LiteLLM gateway at `GATEWAYS__AI__BASE_URL` (default `http://localhost:4000`), which this runbook does not boot. Reading-generation intents are unreachable until the gateway is reachable or stubbed.
- **SPA / API wiring**: the Vite dev server proxies `/api/*` to the backend, stripping the prefix (`frontend/vite.config.ts`); `VITE_API_TARGET` overrides the target. The combined production image is not this story — see root `AGENTS.md` → Docker for how it serves and proxies the SPA.
- **Port contention**: the declared ports must be free — a running `npm run db`, `npm run up`, an IDE-launched backend, a `npm run dev` from another checkout, or another repo's compose stack holds them. The stop commands are deliberately scoped: the bracketed `[u]vicorn` pattern cannot match the shell running the `pkill` (an unbracketed pattern would), and `fuser -k` selects by port, so teardown never kills another checkout's Vite server.

## mysql

| | |
|---|---|
| start | `docker compose up -d mysql` |
| ready | `docker compose exec -T mysql mysqladmin ping -h 127.0.0.1` |
| port  | `3306` |
| stop  | `docker compose down` |
| build | — |
| env   | — |
| cwd   | `.` |

## backend

| | |
|---|---|
| start | `uv run poe migrate && uv run poe run` |
| ready | `curl -fsS http://localhost:8080/health/internal` |
| port  | `8080` |
| stop  | `pkill -f "[u]vicorn shougong.application.boot:app"` |
| build | `uv sync` |
| env   | `DICTIONARY_AUTOLOAD=false`<br>`HSK_ENRICH_AUTOLOAD=false` |
| cwd   | `backend` |

## frontend

| | |
|---|---|
| start | `npm run dev` |
| ready | `curl -fsS http://localhost:5273/` |
| port  | `5273` |
| stop  | `fuser -k 5273/tcp` |
| build | `npm ci` |
| env   | `VITE_API_TARGET=http://localhost:8080` |
| cwd   | `frontend` |
