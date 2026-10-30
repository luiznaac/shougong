# AGENTS.md — shougong frontend

React 19 + Vite + TypeScript + Tailwind v4 + TanStack Query + React Router SPA for the handwriting-SRS trainer — same stack and conventions across all of luiznaac's frontends, see salgadinhos' `react-spa-screen` skill for the shared parts (Tailwind v4-in-CSS, TanStack Query v5 object syntax, the `api/`→`components/`→`pages/`→`lib/` layout, the dev proxy/base-path setup). This file only covers what's specific to shougong.

## Code map

- [`docs/code-map.md`](docs/code-map.md)

## Commands

```bash
npm run dev          # vite dev server
npm run typecheck    # tsc -b --noEmit
npm run lint         # biome check
npm run lint:fix     # biome check --write
npm run test         # vitest run — src/**/*.test.{ts,tsx}, node environment
npm run check        # typecheck + lint + test — run before considering a change done
npm run build        # tsc -b && vite build
```

Tests run in Vitest's node environment: pure helpers in `src/lib/**/*.test.ts` and, where a rendered contract matters, markup-only component tests (`src/components/**/*.test.tsx`) using `react-dom/server` — no DOM/Testing Library dependency.

## Coding standards

- [`CODING_STANDARDS.md`](CODING_STANDARDS.md) — "the language-idiom rules the tooling does not enforce"

## Shougong-specific pieces

- **`hanzi-writer`** draws stroke order (`components/StrokeOrder.tsx`, `components/StrokeOrderPanel.tsx`) from stroke/median data the backend serves — see `CharacterStrokes` in `api/types.ts`. Coordinate space is a 1024×1024 box with the Y-axis flipped; see the comment in `api/types.ts` before touching stroke-rendering code.
- **`i18n/`** holds label mappings for backend enums (`partOfSpeech.ts`, `vocabularyCategory.ts`) — pt-BR display strings keyed by the backend's English enum values. Add a mapping here whenever the backend introduces a new enum value that reaches the UI, in the same PR as the backend change.
- **`Lesson.tsx`/`Review.tsx`** run full-screen, outside the normal `Layout` chrome (see `App.tsx`'s route tree) — they're the two review/quiz flows, deliberately distraction-free.
- **Pinyin/tone coloring** (`components/Pinyin.tsx`, the `.tone-1`–`.tone-5` classes in `index.css`) follows a fixed hue scheme — keep new tone-related UI consistent with it rather than picking new colors ad hoc.

## Read when…

- Adding a page in the review/lesson flow → look at `Review.tsx`/`Lesson.tsx` first, they're intentionally outside `Layout`.
- Changing what the UI shows for a backend enum → `i18n/`, and check `../docs/03-data-model.md` for the enum's full value set before assuming you've covered every case.

Git/PR conventions: see `salgadinhos/global/AGENTS.md`.
