# Code map

Module → key files → seam index for the `frontend/` lane, plus the app entry points. React 19 + Vite + TypeScript, Tailwind v4-in-CSS, TanStack Query v5, React Router and hanzi-writer; `api/` → `components/` → `pages/` → `lib/`. Vocabulary: **module**, **interface**, **seam**, **adapter**.

## Modules

### `src/api` — backend adapter and wire types
**Purpose**: the only place that talks HTTP — the fetch wrapper, the hand-mirrored Pydantic DTOs and the TanStack Query hooks.
**Files**: `frontend/src/api/client.ts`, `frontend/src/api/types.ts`, `frontend/src/api/queries.ts`
**Seam(s)**:
- **DTO mirror** (`api/types.ts`) — mirrors `backend/src/shougong/httpapi/schema.py` (`DictionaryEntry`, `CharacterStrokes`, `SrsCard`, `StudyItem`, `ReviewLog`, batch-import and reading shapes, plus `SrsRating`/`SrsState`); update both in the same commit. `CharacterStrokes.medians` are raw hanzi-writer data in a 1024×1024 box with the Y-axis flipped (see `components/StrokeOrder.tsx`).
- **Fetch adapter** (`api/client.ts`) — `BASE` is `VITE_API_BASE ?? "/api"`; `ApiError` carries `status` and the `{detail}` message; `request<T>` treats `204` as `undefined`. A new endpoint adds a method to `api`, not another fetch wrapper.
- **Query seam** (`api/queries.ts`) — the `keys` factory (`studyItems`, `studyItem`, `reviews`, `history`, `dictionary`, `readingHistory`) plus the non-factory keys (`["strokes", character]`, `["review-queue"]`). `useStudyItems` pages through `api.listAllStudyItems` (backend cap 200); `useCharacterStrokes` sets `retry: false` (a 404 means "no stroke data") and `staleTime: Infinity` (stroke data never changes).

### `src/pages` — routed screens
**Purpose**: the seven screens — dashboard, add/batch-import, study-item detail, reading, and the full-screen lesson/review flows.
**Files**: `frontend/src/pages/Dashboard.tsx`, `pages/AddItems.tsx`, `pages/BatchImport.tsx`, `pages/StudyItemPage.tsx`, `pages/Reading.tsx`, `pages/Lesson.tsx`, `pages/Review.tsx`
**Seam(s)**:
- **Review queue** (`pages/Review.tsx`) — snapshots the due queue once on entry (`staleTime: Infinity`, `gcTime: 0`), keeps only `review`/`relearning` cards (new `learning` items go to the lesson flow) and hands it to `Quiz`.
- **Lesson flow** (`pages/Lesson.tsx`) — the other full-screen flow, mounted outside the `Layout` chrome in `App.tsx`.
- **Reading** (`pages/Reading.tsx`) — composes the generation controls, history, topic panel and vocabulary panel; model choice is persisted client-side (`reading.model`), and numeric inputs are clamped to the backend bounds.
- **Batch import** (`pages/BatchImport.tsx`) — parses the CSV locally, then sends one row at a time and layers `pending`/`loading` display states over the backend outcome.

### `src/components` — chrome, quiz and Chinese-language widgets
**Purpose**: the layout chrome, the quiz/lesson machinery, the stroke-order renderers and the reading/vocabulary panels.
**Files**: `frontend/src/components/{Layout,Quiz,HandwritingQuiz,StrokeOrder,StrokeOrderPanel,Pinyin,Hanzi,RelatedEntries,VocabularyPanel,ReadingTopicsPanel,ProgressTiles,UpcomingReviews,SrsDistribution,ItemMetricChart,ItemsLearnedChart}.tsx`
**Seam(s)**:
- **Chrome seam** (`components/Layout.tsx`) — the header nav (`/`, `/add`, `/add/batch`, `/reading`) and the routed `<Outlet />`; `Lesson`/`Review` are deliberately outside it.
- **Stroke coordinate seam** (`components/StrokeOrder.tsx`, `HandwritingQuiz.tsx`) — converts hanzi-writer's raw (Y-up, top-left at `(0, 900)`) data into a top-down 0..1024 SVG box; `HandwritingQuiz` feeds the same cached data through `charDataLoader` so it never hits a CDN.
- **Quiz phase seam** (`components/Quiz.tsx`) — the `info → prompt → revealed` phase machine over an item queue, with the `RATINGS` (`again`/`hard`/`good`/`easy`) as the review submission and keyboard hotkeys; `HandwritingQuiz` is the optional interactive check.
- **Pinyin rendering** (`components/Pinyin.tsx`) — consumes `lib/pinyin.ts` syllables and the `.tone-1`–`.tone-5` classes from `index.css`.

### `src/i18n` — backend-enum display labels
**Purpose**: pt-BR labels for backend enums that reach the UI.
**Files**: `frontend/src/i18n/partOfSpeech.ts`, `frontend/src/i18n/vocabularyCategory.ts`
**Seam(s)**: **Label maps** — `partOfSpeechLabel(...)` and `vocabularyCategoryLabel(...)` are exhaustive `Record<BackendEnum, string>` maps; a new backend enum value fails the type until it is translated here (same PR as the backend change). `VOCABULARY_CATEGORIES` is the select order.

### `src/lib` — pure helpers
**Purpose**: the unit-testable surface — CSV parsing, pinyin conversion, the display-only SRS ladder, local settings and formatting.
**Files**: `frontend/src/lib/csv.ts`, `lib/pinyin.ts`, `lib/srs.ts`, `lib/localSettings.ts`, `lib/format.ts`
**Seam(s)**:
- **CSV seam** (`lib/csv.ts`) — `parseStudyItemsCsv(text)` accepts a hanzi/pinyin header, comma or semicolon, quoted fields; it never validates pinyin (the backend reports per-row).
- **Pinyin seam** (`lib/pinyin.ts`) — `parsePinyin(numbered)` → `{text, tone}` and `toAccented`; the tone-mark placement rule lives here, not in a component.
- **SRS display ladder** (`lib/srs.ts`) — derived from the backend's continuous `stability` (days), not a stored level; `LEVELS`/`GROUP_ORDER`/`GROUP_COLOR` are the single ladder and palette.
- **Local settings** (`lib/localSettings.ts`) — `useHandwritingEnabled`/`useHandwritingTolerance` persist per browser; `allowedMistakes(strokeCount, tolerancePercent)` scales the tolerance by the character's own stroke count.
- **Formatting** (`lib/format.ts`) — `fromNow`/`formatDateTime`/`formatDate`, all `pt-BR`.

### Theme and root wiring
**Purpose**: the design tokens and the Vite/TypeScript build that serves the SPA.
**Files**: `frontend/src/index.css`, `frontend/vite.config.ts`, `frontend/index.html`, `frontend/package.json`, `frontend/tsconfig*.json`
**Seam(s)**:
- **Theme seam** (`src/index.css`) — the `@theme` block owns the hanzi font, the accent, the pinyin tone colours (`--color-tone-*`), the SRS stage colours (`--color-srs-*`) and the `.tone-*` classes; components consume those names.
- **Base-path seam** (`vite.config.ts`) — `base` is `/shougong/` in production and `/` in dev; `main.tsx` derives the router `basename` from `import.meta.env.BASE_URL`.
- **Dev server** (`vite.config.ts`) — port 5273 with the `/api` proxy to `VITE_API_TARGET ?? http://localhost:8080`.
- **Quality gate** (`package.json`) — `typecheck` and `build` only; there is no lint or test script in this lane.

## Entry points

- `frontend/src/main.tsx` — mounts React `StrictMode` with the `QueryClient` and the browser router.
- `frontend/src/App.tsx` — the route table: `/` under `Layout` (index `Dashboard`, `add`, `add/batch`, `items/:id`, `reading`) plus `/lesson` and `/review` outside the chrome.
- `frontend/index.html` — the Vite HTML shell with the `#root` mount.
- `frontend/vite.config.ts` — dev server, base path and API proxy.
- `frontend/src/index.css` — the design-token entry imported by `main.tsx`.
