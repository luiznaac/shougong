# Acceptance runbook — shougong

Bootstrap-only runbook for the `self-served-acceptance` runner: one section per service, in start order. The runner owns the browser process; there is deliberately no browser section here.

### Setup prose

- **Clean-checkout prerequisites**: Docker with a reachable daemon, `uv` (the backend's toolchain), and Node 22 + npm. No other host state is touched.
- **Schema**: the `backend` section applies the schema and the acceptance fixture before serving; the app does not migrate itself outside the container entrypoint. MySQL starts empty, so the Alembic migration is the only schema seed.
- **Env fixtures**: every backend setting has a dev default, so no `backend/.env` is required for a bare boot. Copy `backend/.env.example` to the gitignored `backend/.env` only to override a default. No secret is needed: MySQL runs as `root` with an empty password, and the AI gateway is not booted.
- **Acceptance fixture**: `uv run poe seed:acceptance` writes the committed dev-only fixture (`src/shougong/acceptance/fixture.py`) after the migration and before the app starts. It seeds dictionary entries (varied pinyin, definitions, raw POS tags, HSK 1..9 and none) and study items (more than one 24-row page, all three SRS states, varied stability/difficulty/due/created_at, a leech and a pinned item), plus the item-detail rows: the pinned learning word 知道 with a multi-snapshot trajectory, its shared-character related family (more than one 8-row page, with a queued neighbour), three readings containing the word (one with an extra word) and cached strokes for every character of the word. All times are relative to the run, so the list and item-detail walkthroughs are reproducible from this runbook alone. It is a no-op once the dictionary is non-empty, and the package is excluded from the production image (`.dockerignore`).
- **Dictionary / HSK autoload is off** in the `backend` section. Both downloads are background, non-fatal startup tasks, but they need network and pay a large first-boot cost. The fixture above supplies the dictionary and HSK data the list intents need, so leave autoload off and do not treat those intents as a known gap.
- **Fold-aware visuals**: a manifest visual clause asserts only content inside the runner's 1280×720 fold; panels below it (the item detail's Leituras and Relacionados, for example) are covered by DOM assertions instead.
- **CSV import results at 1280×720**: the twelve-per-page CSV result rows — including the `erro` rows, which are the last ones — extend below the fold at the runner's fixed 1280×720 viewport; roughly nine rows fit below the input stack and summary tiles. For the `erro` pill's visual clause, scroll it into the fold before the capture (the candidate-pick interaction, or an explicit hover/click that brings the row into frame) instead of asserting from a top-of-page static capture; the fold rule above still holds for the capture itself. This is a verification choice, not a layout defect: the summary tiles and the first result rows stay visible without scrolling.
- **Reading generation** needs the LiteLLM gateway at `GATEWAYS__AI__BASE_URL` (default `http://localhost:4000`), which this runbook does not boot. Reading-generation intents are unreachable until the gateway is reachable or stubbed.
- **SPA / API wiring**: the Vite dev server proxies `/api/*` to the backend, stripping the prefix (`frontend/vite.config.ts`); `VITE_API_TARGET` overrides the target and `FRONTEND_DEV_PORT` the bind port (strict — a taken port fails instead of auto-incrementing). The combined production image is not this story — see root `AGENTS.md` → Docker for how it serves and proxies the SPA.
- **Port contention**: the declared ports must be free — a running `npm run db`, `npm run up`, an IDE-launched backend, a `npm run dev` from another checkout, or another repo's compose stack holds them. The stop commands are deliberately scoped: the bracketed `[s]hougong` pattern cannot match the shell running the `pkill` (an unbracketed pattern would), and `fuser -k` selects by port, so teardown never kills another checkout's Vite server.

## mysql

| | |
|---|---|
| start | `docker compose up -d mysql` |
| ready | `docker compose exec -T mysql mysqladmin ping -h 127.0.0.1` |
| port  | `8132` |
| stop  | `docker compose down` |
| build | — |
| env   | — |
| cwd   | `.` |

## backend

| | |
|---|---|
| start | `uv run poe migrate && uv run poe seed:acceptance && uv run poe run` |
| ready | `curl -fsS http://localhost:8130/health/internal` |
| port  | `8130` |
| stop  | `pkill -f "[s]hougong.application.boot"` |
| build | `uv sync` |
| env   | `DICTIONARY_AUTOLOAD=false`<br>`HSK_ENRICH_AUTOLOAD=false` |
| cwd   | `backend` |

## frontend

| | |
|---|---|
| start | `npm run dev` |
| ready | `curl -fsS http://localhost:8133/` |
| port  | `8133` |
| stop  | `fuser -k 8133/tcp` |
| build | `npm ci` |
| env   | `VITE_API_TARGET=http://localhost:8130`<br>`FRONTEND_DEV_PORT=8133` |
| cwd   | `frontend` |
