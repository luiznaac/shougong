# shougong-fe

Frontend for the [`shougong`](../backend) Chinese handwriting SRS. A React + Vite + TypeScript + Tailwind v4 SPA consuming the backend's HTTP API.

Aesthetics inspired by HanziHero (dashboard, coloured quiz bands, tone-coloured pinyin, Noto Sans SC), with the SRS level ladder grouped à la WaniKani.

## Prerequisites

- **Node.js 22.12+** (it was not installed on the machine when the project was created — install it via `winget install OpenJS.NodeJS.LTS` or <https://nodejs.org>).
- The `shougong` backend running (`uv run poe run` → `http://localhost:8130`).

## Run in dev

```bash
npm install
npm run dev
```

It opens at `http://localhost:8133` — the port is strict (`FRONTEND_DEV_PORT`): if it is taken, the server fails instead of picking the next free one. Calls to `/api/*` are _proxied_ to `http://localhost:8130` (configured in `vite.config.ts`, adjustable via `VITE_API_TARGET`). That way the backend needs no CORS change.

> In PowerShell, if `npm` is blocked by the execution policy (`npm.ps1 cannot be loaded`), use `npm.cmd install` / `npm.cmd run dev`, or allow it with `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

## Build

```bash
npm run build      # writes dist/ with base path /shougong/ (for the reverse proxy)
npm run preview
```

To build at the root (`/`) instead of `/shougong/`: `VITE_BASE=/ npm run build`.

## Screens

| Route         | What                                                                       |
| ------------- | -------------------------------------------------------------------------- |
| `/`           | HanziHero-style dashboard: 2 buttons, SRS distribution, upcoming reviews, tiles |
| `/lesson`     | Lesson quiz (full screen) — items in `learning`                            |
| `/review`     | Review quiz (full screen) — items in `review` that are _due_               |
| `/items/:id`  | Item page: FSRS, trajectory chart, related items                           |
| `/add`        | Dictionary search and add items to the queue                               |

The dashboard's two buttons: **left (blue)** = number of items in `learning` → `/lesson`; **right (red)** = number of items in `review` and _due_ (ignores `learning`) → `/review`.

### Quiz (review and lesson)

Full screen, HanziHero style: a coloured band with the subject (tone-coloured pinyin in a pill + the cards + meaning), a dark band with the question, and a toolbar at the bottom with **Rollback** and **Next**.

The character appears in one **card per character** (N-character words → N cards). The cards **flip** (3D) to hide/reveal — all together.

**Review** (inverted — writing practice):

1. The band shows **pinyin + meaning**; the cards are flipped to `?`.
2. You write the character by hand on paper.
3. **Next** (`Space`/`Enter`) → the cards flip and reveal the hanzi.
4. Choose `1` Missed · `2` Hard · `3` Good · `4` Easy — this only **selects**.
5. **Next** confirms and submits (`POST /study-items/{id}/reviews`); it only enables after a grade is selected. `again` counts as a miss in accuracy.
6. **Rollback** (`Backspace`/`z`) undoes the selected grade; with no selection, it goes back one step (re-hides the card). `Esc` exits.

**Lesson**: each item starts in a **presentation** step with the cards already showing the hanzi; **Next** flips the cards to hide them and continues exactly like review. After the quiz the item becomes a normal `review` via FSRS.

If an item is no longer available when submitted (the backend answers `409`), it is skipped with a warning.

## Architecture notes

- `src/api/` — typed HTTP client + TanStack Query hooks. The types in `types.ts` mirror the backend's `httpapi/schema.py`.
- `src/components/Quiz.tsx` — the full-screen engine shared by `/review` and `/lesson` (phases, flip, grade selection, Next/Rollback, shortcuts).
- `src/components/Hanzi.tsx` — renders hanzi on a single line, shrinking the font for multi-character words (used outside the quiz — tiles, header, search).
- `src/components/RelatedEntries.tsx` — "Related items" on the item page: `GET /dictionary-entries?q=<hanzi>` (words containing the character), minus the item itself; the ones already in study link to the page, the rest get "Add".
- `src/lib/pinyin.ts` — converts numbered pinyin (`zhi1 dao4`) to accented and exposes each syllable's tone; `<Pinyin>` colours by tone (palette in `index.css`, `--color-tone-*`), or `coloured={false}` for plain text.
- `src/lib/srs.ts` — the backend stores raw FSRS only (state + stability). The HanziHero-style level ladder is derived **on the client** from `stability` (days): Novice I/II (1d, 4d), Apprentice I/II (1w, 2w), Journeyman I/II (1mo, 2mo), Expert I/II/III (4mo, 8mo, 1y), Master (>1 year). The dashboard chart groups into Novice/Apprentice/Journeyman/Expert/Master.
- `GET /study-items/{id}/history` — item snapshots per state change; the item page plots stability + difficulty over time.
- `GET /study-items/history/learning-to-review` — each item's learning→review transition (paginated, `limit`/`offset`); the dashboard aggregates by `created_at` into a cumulative "Items learned" chart. `src/api/client.ts` paginates this in `listLearningToReviewHistory()`.
- Mnemonics, component decomposition and levels **do not exist** in the backend yet — they belong to a future phase (a new table + fields).
