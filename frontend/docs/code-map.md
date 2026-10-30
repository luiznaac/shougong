# Code map

Module → key files → seam index for the `frontend/` lane, plus the app entry points. React 19 + Vite + TypeScript, Tailwind v4-in-CSS, TanStack Query v5, React Router and hanzi-writer; `api/` → `components/` → `pages/` → `lib/`. Vocabulary: **module**, **interface**, **seam**, **adapter**.

## Modules

### `src/api` — backend adapter and wire types
**Purpose**: the only place that talks HTTP — the fetch wrapper, the hand-mirrored Pydantic DTOs and the TanStack Query hooks.
**Files**: `frontend/src/api/client.ts`, `frontend/src/api/types.ts`, `frontend/src/api/queries.ts`
**Seam(s)**:
- **DTO mirror** (`api/types.ts`) — mirrors `backend/src/shougong/httpapi/schema.py` (`DictionaryEntry`, `CharacterStrokes`, `SrsCard`, `StudyItem`, `ReviewLog`, batch-import and reading shapes, plus `SrsRating`/`SrsState`); update both in the same commit. `CharacterStrokes.medians` are raw hanzi-writer data in a 1024×1024 box with the Y-axis flipped (see `components/StrokeOrder.tsx`).
- **Fetch adapter** (`api/client.ts`) — `BASE` is `VITE_API_BASE ?? "/api"`; `ApiError` carries `status` and the `{detail}` message; `request<T>` treats `204` as `undefined`. A new endpoint adds a method to `api`, not another fetch wrapper.
- **Query seam** (`api/queries.ts`) — the `keys` factory (`studyItemsPrefix`, `studyItems`, `studyItem`, `reviews`, `history`, `dictionary`, `readingHistory`, `insightsPrefix`, `extraStudy`) plus the non-factory keys (`["study-session", kind]` from `lib/studySession.ts`, `["strokes", character]`). `studyItems` carries `{due, leech}`; `useStudyItems` pages through `api.listAllStudyItems` (backend cap 200); `useCharacterStrokes` sets `retry: false` (a 404 means "no stroke data") and `staleTime: Infinity` (stroke data never changes). `useStudySession` sits outside the `["study-items"]` prefix with infinite stale time and zero cache time, so study-item invalidation never refetches or reshuffles a running session. `useExtraStudy` keys on the two range instants under `["insights"]`, takes its stale time per observer (60 s on the dashboard, infinite in practice), and `invalidateAfterReview` is the single real-grade refresh policy: it invalidates both the study-items and insights prefixes so the character grids and Extra Study counts stay current. Practice calls no mutation, so nothing is invalidated. `priorityMutationOptions` owns the optimistic priority policy: it cancels the study-items queries, writes the predicted edge position into every cached list and the single-item cache, snapshots them for rollback, seeds the single item from the server response, and on settle invalidates the study-items prefix and the lesson-session key.

### `src/pages` — routed screens
**Purpose**: the eight screens — dashboard, add/batch-import, study-item detail, reading, and the full-screen lesson/review/practice flows.
**Files**: `frontend/src/pages/Dashboard.tsx`, `pages/AddItems.tsx`, `pages/BatchImport.tsx`, `pages/StudyItemPage.tsx`, `pages/Reading.tsx`, `pages/Lesson.tsx`, `pages/Review.tsx`, `pages/Practice.tsx`
**Seam(s)**:
- **Study session seam** (`pages/Lesson.tsx`, `pages/Review.tsx`, `api/queries.ts`, `lib/studySession.ts`) — each flow reads `GET /study/session?kind=…` once on entry (`staleTime: Infinity`, `gcTime: 0`) and hands the received item order to `Quiz` verbatim — no client filter or sort. The backend owns lesson membership (all `learning`, pinned first then shuffled remainder) and review membership (due, non-learning, fully shuffled); a remount or refresh is a new session with a new shuffle. `useReviewMutation` invalidates the `["study-items"]` prefix, the insights prefix, the single item and its review list, but not the running session.
- **Practice seam** (`pages/Practice.tsx`, `lib/extraStudy.ts`, `components/Quiz.tsx`) — reads `bucket` and the two range instants from the URL, re-reads the same `["insights", "extra-study", …]` query the dashboard used and holds it with infinite stale time, then hands the bucket's items to `Quiz` with `record={false}`. That seam issues no grade request at all; the top bar reads `Prática` with an `SRS intact` chip and the summary says nothing was recorded.
- **Extra Study panel** (`components/ExtraStudyPanel.tsx`, `pages/Dashboard.tsx`, `lib/extraStudy.ts`) — sits directly below the two big buttons; local `De`/`Até` date state drives one insight request keyed by its two local-midnight instants. Tabs use `tablist`/`tab`/`tabpanel` roles with both server totals always visible; the active tab's wrapped grid is `ProgressTiles` in received order, and `Praticar` is disabled at zero.
- **Priority quick actions** (`components/LessonQueuePanel.tsx`, `components/ItemPrioritySection.tsx`, `pages/Dashboard.tsx`, `pages/StudyItemPage.tsx`, `lib/lessonQueue.ts`) — the dashboard's `Próximas lições` panel sits between Extra Study and the SRS distribution and disappears at an empty learning queue; it lists pinned items by position then id and unpinned items by creation then id with contiguous 1-based ordinals. Both the panel and the item page reuse `PriorityActions` (front/back/remove with item-scoped names, inline `role="alert"` failures and `aria-busy`), and the item-page section renders only while the item is still `learning`. The quiz runner carries no priority controls, so a running session order stays frozen.
- **Character panel** (`pages/Dashboard.tsx`, `lib/characterPanel.ts`) — the `Todas (n)`/`Sanguessugas (n)` chip pair is component state (not a URL param) over a labelled `fieldset` with `aria-pressed` buttons. `Todas` keeps the stability sort; `Sanguessugas` uses `GET /study-items?leech=true` and renders the server's worst-first order verbatim. The leech list is fetched eagerly, its count is always visible, and zero leeches show an empty sentence distinct from loading.
- **Reading** (`pages/Reading.tsx`) — composes the generation controls, history, topic panel and vocabulary panel; model choice is persisted client-side (`reading.model`), and numeric inputs are clamped to the backend bounds.
- **Batch import** (`pages/BatchImport.tsx`) — parses the CSV locally, then sends one row at a time and layers `pending`/`loading` display states over the backend outcome.

### `src/components` — chrome, quiz and Chinese-language widgets
**Purpose**: the layout chrome, the quiz/lesson machinery, the stroke-order renderers and the reading/vocabulary panels.
**Files**: `frontend/src/components/{Layout,Quiz,HandwritingQuiz,FullScreenMsg,StrokeOrder,StrokeOrderPanel,Pinyin,Hanzi,RelatedEntries,VocabularyPanel,ReadingTopicsPanel,StudyItemTile,ProgressTiles,PriorityActions,LessonQueuePanel,ItemPrioritySection,ExtraStudyPanel,UpcomingReviews,SrsDistribution,ItemMetricChart,ItemsLearnedChart}.tsx`
**Seam(s)**:
- **Character tile** (`components/StudyItemTile.tsx`, `lib/tileBadges.ts`) — the one tile used by every character grid and the item page header, fixed at `w-28` with the SRS level border. `tileBadges(item)` derives the overlays from the DTO alone: a ghost for `is_leech`, then a bolt for a non-null `priority_position`, rendered as dark `role="img"` chips with a pt-BR `aria-label` and a `title`. `ProgressTiles` only wraps a grid and never re-sorts its input. The quiz runner renders none of this.
- **Chrome seam** (`components/Layout.tsx`) — the header nav (`/`, `/add`, `/add/batch`, `/reading`) and the routed `<Outlet />`; `Lesson`/`Review`/`Practice` are deliberately outside it.
- **Stroke coordinate seam** (`components/StrokeOrder.tsx`, `HandwritingQuiz.tsx`) — converts hanzi-writer's raw (Y-up, top-left at `(0, 900)`) data into a top-down 0..1024 SVG box; `HandwritingQuiz` feeds the same cached data through `charDataLoader` so it never hits a CDN.
- **Quiz phase seam** (`components/Quiz.tsx`) — the `info → prompt → revealed` phase machine over an item queue, with the `RATINGS` (`again`/`hard`/`good`/`easy`) as the review submission and keyboard hotkeys; `HandwritingQuiz` is the optional interactive check. Its `record` prop defaults to true; practice passes false, which skips the grade call entirely while keeping the same runner and local accuracy.
- **Pinyin rendering** (`components/Pinyin.tsx`) — consumes `lib/pinyin.ts` syllables and the `.tone-1`–`.tone-5` classes from `index.css`.

### `src/i18n` — backend-enum display labels
**Purpose**: pt-BR labels for backend enums that reach the UI.
**Files**: `frontend/src/i18n/partOfSpeech.ts`, `frontend/src/i18n/vocabularyCategory.ts`
**Seam(s)**: **Label maps** — `partOfSpeechLabel(...)` and `vocabularyCategoryLabel(...)` are exhaustive `Record<BackendEnum, string>` maps; a new backend enum value fails the type until it is translated here (same PR as the backend change). `VOCABULARY_CATEGORIES` is the select order.

### `src/lib` — pure helpers
**Purpose**: the unit-testable surface — CSV parsing, pinyin conversion, the display-only SRS ladder, local settings, extra-study range arithmetic and formatting.
**Files**: `frontend/src/lib/csv.ts`, `lib/pinyin.ts`, `lib/srs.ts`, `lib/localSettings.ts`, `lib/format.ts`, `lib/studySession.ts`, `lib/tileBadges.ts`, `lib/characterPanel.ts`, `lib/lessonQueue.ts`, `lib/extraStudy.ts`, `lib/quizPractice.ts`
**Seam(s)**:
- **Tile badge seam** (`lib/tileBadges.ts`) — `tileBadges(item)` returns the ordered ghost/bolt descriptors (ghost first) with their emoji, pt-BR label and title; `StudyItemTile` renders exactly this list.
- **Character filter seam** (`lib/characterPanel.ts`) — `orderCharacterTiles(filter, {all, leeches})` owns the two orderings: stability descending for `Todas`, received order untouched for `Sanguessugas`.
- **Lesson queue and priority seam** (`lib/lessonQueue.ts`) — `lessonQueueRows(items)` filters `learning`, sorts pinned by position then id and unpinned by creation then id, and stamps contiguous 1-based ordinals; `predictPriorityPosition` and `applyCachedPriority` are the pure halves of the optimistic update; `priorityErrorMessage` owns the pt-BR inline copy, including the 409 graduation sentence.
- **CSV seam** (`lib/csv.ts`) — `parseStudyItemsCsv(text)` accepts a hanzi/pinyin header, comma or semicolon, quoted fields; it never validates pinyin (the backend reports per-row).
- **Pinyin seam** (`lib/pinyin.ts`) — `parsePinyin(numbered)` → `{text, tone}` and `toAccented`; the tone-mark placement rule lives here, not in a component.
- **SRS display ladder** (`lib/srs.ts`) — derived from the backend's continuous `stability` (days), not a stored level; `LEVELS`/`GROUP_ORDER`/`GROUP_COLOR` are the single ladder and palette.
- **Local settings** (`lib/localSettings.ts`) — `useHandwritingEnabled`/`useHandwritingTolerance` persist per browser; `allowedMistakes(strokeCount, tolerancePercent)` scales the tolerance by the character's own stroke count.
- **Session query policy** (`lib/studySession.ts`) — `studySessionKey(kind)` and `STUDY_SESSION_QUERY` pin the session hooks outside the `["study-items"]` prefix with infinite stale time and zero cache time.
- **Extra Study range** (`lib/extraStudy.ts`) — local calendar-day helpers: `toDay`/`addDays`, the last-three-day default, the today-29-to-today bounds, `clampDay`/`clampRangeEndpoint` for typed input (bounds plus `from <= to`), `rangeInstants` (from → local midnight, to → next local midnight), the bucket list/predicate, and `parsePracticeSearch` for the practice URL.
- **Practice copy and write seam** (`lib/quizPractice.ts`) — `topBarTitle`/`summaryCopy` own the practice variant's labels: `Prática`, the `SRS intact` run, and the summary saying nothing was recorded. `submitRevealedGrade` is the only place a revealed advance decides whether to call the grade mutation; with `record: false` it never calls the submit callback, so practice issues no write at all.
- **Formatting** (`lib/format.ts`) — `fromNow`/`formatDateTime`/`formatDate`, all `pt-BR`.

### Theme and root wiring
**Purpose**: the design tokens and the Vite/TypeScript build that serves the SPA.
**Files**: `frontend/src/index.css`, `frontend/vite.config.ts`, `frontend/index.html`, `frontend/package.json`, `frontend/tsconfig*.json`
**Seam(s)**:
- **Theme seam** (`src/index.css`) — the `@theme` block owns the hanzi font, the accent, the pinyin tone colours (`--color-tone-*`), the SRS stage colours (`--color-srs-*`) and the `.tone-*` classes; components consume those names.
- **Base-path seam** (`vite.config.ts`) — `base` is `/shougong/` in production and `/` in dev; `main.tsx` derives the router `basename` from `import.meta.env.BASE_URL`.
- **Dev server** (`vite.config.ts`) — port 5273 with the `/api` proxy to `VITE_API_TARGET ?? http://localhost:8080`.
- **Quality gate** (`package.json`) — `check` runs `typecheck` + `lint` (Biome) + `test` (Vitest, node environment: pure helpers in `src/lib` and markup-only tile tests through `react-dom/server`).

## Entry points

- `frontend/src/main.tsx` — mounts React `StrictMode` with the `QueryClient` and the browser router.
- `frontend/src/App.tsx` — the route table: `/` under `Layout` (index `Dashboard`, `add`, `add/batch`, `items/:id`, `reading`) plus `/lesson`, `/review` and `/practice` outside the chrome.
- `frontend/index.html` — the Vite HTML shell with the `#root` mount.
- `frontend/vite.config.ts` — dev server, base path and API proxy.
- `frontend/src/index.css` — the design-token entry imported by `main.tsx`.
