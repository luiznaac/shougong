# UI / UX Spec — Responsive Redesign

The single spec for the responsive, desktop-first redesign of the SPA. It settles the
visual language, the navigation model, the per-surface layouts, the shared component
inventory, the pagination rules and the API contracts the redesign needs. Implementation
follows this document; nothing here is a proposal any more.

Desktop is the richest experience; mobile is a full-parity fallback. Every screen works on
mobile, and nothing is desktop-only except CSV batch import, which is a deliberate
exception recorded in the shell section.

Behaviour is preserved: study scheduling, FSRS, quiz grading, persistence and the session
state machine are untouched. The redesign changes layout, IA and visuals only.

## Design principles

1. **Today first.** The home surface answers "what do I study now" with one obvious action.
2. **One glyph per phase.** A practice phase never draws the same word twice.
3. **Context preservation.** Drill-downs happen in rails, bounded panes and inline swaps,
   never by destroying the surface that was being read.
4. **Progressive disclosure.** FSRS internals, generation attempts, working sets and CSV
   diagnostics stay behind panels, drawers or item pages.
5. **Legible scheduling.** FSRS state reads as plain language plus a stage colour; colour
   never carries information on its own beyond the stage ramp it repeats.
6. **Bounded surfaces.** Lists page or grow by an explicit control; no surface grows without
   limit and no list scrolls forever.
7. **Empty states are guidance.** Every panel has its own empty copy and its own skeleton.

## Information architecture

```text
App
├── Hoje                  (dashboard)
│   ├── Review session    (full-screen)
│   ├── Lesson session    (full-screen)
│   └── Practice          (full-screen, extra study)
├── Biblioteca
│   ├── Itens             (study item list → item detail)
│   ├── Adicionar         (dictionary search → queue)
│   └── Importar CSV      (desktop only)
├── Leitura               (generator + article + history + word inspector)
├── Progresso
└── Ajustes
```

The global sections are **Hoje / Biblioteca / Leitura / Progresso**. Adicionar and Importar
CSV live under Biblioteca, not in the global navigation. Ajustes is reached from the desktop
account chip and from the mobile **Mais** sheet. Lesson, Review and Practice are full-screen
routes outside the app chrome.

This replaces the current Painel / Adicionar / Importar CSV / Leitura bar.

## App shell

Adopted from [Prototype: app shell, navigation and visual refresh](https://github.com/luiznaac/shougong/issues/105)
(variant A, "Command bar").

### Desktop

- A sticky top bar, `h-16`, `border-b border-white/10`, `bg-slate-950/80 backdrop-blur`,
  content in a `max-w-6xl` centred container with `px-6`.
- Left: the brand lockup (`手工` in cerise, `shougong` beside it), then flat nav links
  **Hoje / Biblioteca / Leitura / Progresso**. The active link is `bg-white/10 text-white`;
  the rest are `text-slate-400 hover:text-slate-200`.
- Right: a quiet search affordance (`Buscar` + `⌘K` hint), a **Retomar** chip carrying the
  due count (`bg-accent-500/15 text-accent-300 ring-1 ring-accent-500/30`), and the account
  chip (initials avatar → Ajustes).
- Main content sits in the same `max-w-6xl` container with `px-6 py-8`.

### Mobile

- A top app bar, `h-14`, brand on the left, search icon on the right, `border-b border-white/10`.
- A bottom tab bar pinned to the viewport: **Hoje / Biblioteca / Leitura / Mais**. Active tab
  is `text-accent-500`; icons are 20px with a 9px label.
- **Mais** opens an overflow sheet above the tab bar with **Progresso**, **Adicionar** and
  **Ajustes**. The sheet is a rounded card over the page, not a route.
- **CSV import is desktop-only** and has no mobile entry point. The mobile Adicionar screen
  states where import lives; the Importar CSV route is not reachable from mobile navigation.
- Every mobile screen pads its header with `max(<base>, env(safe-area-inset-top))` and any
  bottom-docked control with `env(safe-area-inset-bottom)`.

## Visual language and tokens

An evolution of today's dark theme, not a departure: dark slate surfaces, cerise accent,
stage colours for SRS.

### Colour

The Tailwind theme in `frontend/src/index.css` keeps its tokens; the redesign adds no new
colour family:

| Token | Value | Use |
| --- | --- | --- |
| `--color-accent-500` | `#e3116c` | cerise — brand, primary CTA tint, active nav |
| `--color-accent-600` | `#c50f5f` | cerise deep — gradient end |
| `--color-srs-apprentice` | `#dd0093` | stage fill / grade key bar |
| `--color-srs-guru` | `#882d9e` | stage fill / grade key bar |
| `--color-srs-master` | `#294ddb` | stage fill / grade key bar |
| `--color-srs-enlightened` | `#0093dd` | stage fill / grade key bar |
| `--color-srs-burned` | `#434343` | retired stage |
| `--color-tone-1..5` | rose / emerald / sky / purple / slate | pinyin tone only |

- Surfaces: page `bg-slate-950`; panels `bg-slate-900/50` with `ring-1 ring-white/10`;
  raised rows and tiles `bg-slate-900/70`; hairlines `border-white/10`.
- The dashboard hero and the practice band are the only gradient surfaces; everything else
  is flat panel + ring.
- Pinyin tone colours are reserved for pinyin and are never reused for SRS meaning.
- The five SRS **display groups** (Novice / Apprentice / Journeyman / Expert / Master) keep
  the palette and thresholds already in `frontend/src/lib/srs.ts` (`GROUP_COLOR`,
  `GROUP_ORDER`); the four **grade** keys use the four `--color-srs-*` stage tokens.
- Tone badges: the 👻 (leech) and ⚡ (priority) emoji become custom inline SVG icons — a
  ghost and a bolt — in circular badges (`bg-slate-950/85 ring-1 ring-white/10`) tinted
  `text-rose-300` and `text-amber-300`.

### Type

- UI: `--font-sans` (Inter). Hanzi: `--font-hanzi` (Noto Sans SC).
- Page title `text-2xl font-semibold text-white`; section label
  `text-xs font-semibold uppercase tracking-wide text-slate-500`; body `text-sm`;
  metadata `text-[11px] text-slate-500`.
- All counts use `tabular-nums`.
- Reading article: `font-hanzi text-[26px] leading-[2.15] tracking-wide text-slate-100`,
  bounded by a `max-w` column so long paragraphs stay comfortable.

### Shape, depth, spacing

- Panels `rounded-2xl`; rows, chips and controls `rounded-lg`; pills `rounded-full`.
- Depth is a ring plus a small blur glow, not drop shadows; the practice dock and cards may
  use `shadow-lg`/`shadow-xl` where they float over a band.
- Character tiles carry a 2px bottom border in their SRS group colour and a `ring-1
  ring-white/5`. Tile corner radius for flip cards is proportional:
  `min(20px, max(6px, size × 0.16))` — a rounded square at every size, never a circle.
- Spacing follows Tailwind's scale; section gaps `space-y-6`, panel padding `p-5`/`p-6`.

### Icons and motion

- No icon library. Icons are inline 24×24 stroke SVGs, `strokeWidth` 1.7 by default
  (badge icons 2.6), `strokeLinecap="round"`, `strokeLinejoin="round"`.
- The set covers: home, book, text, chart, sliders, plus, menu, search, chevron-left/right,
  grid, clock, upload, user, more, close, arrow-right, layers, spark, ghost, bolt. The
  `ghost` and `bolt` paths are part of the component inventory, not the prototype.
- Motion is limited to card flips, stroke playback and panel transitions;
  `prefers-reduced-motion` disables flips and stroke animation.

## Shared component inventory

The redesign extracts these pieces. Each is one component with one owner surface set; the
spec expects the same behaviour wherever it appears. Implementation order belongs to the
rollout decision, not here.

| Component | Shared by | Expectations |
| --- | --- | --- |
| `AppShell` | every route except the three full-screen practice routes | Desktop top bar + content container; mobile top app bar, bottom tabs, Mais sheet; owns safe-area padding on both chrome edges. |
| `PageHeader` | every paged surface | Eyebrow (date/section), title, optional right-side summary chip; consistent `max-w` and spacing across surfaces. |
| `Panel` | every surface | `rounded-2xl bg-slate-900/50 p-5 ring-1 ring-white/10` with an optional uppercase section label and a right-side action slot. All panels are bounded: content never stretches the page. |
| `DataList` | Biblioteca items, dictionary search, batch results, reading history, related entries | One data model, two presentations: a dense table with explicit page controls on desktop, stacked cards with the secondary columns dropped on mobile. Rows carry status and SRS chips; selection state (list position + filter/sort) survives a detail detour. |
| `Pager` | every desktop table/grid | Previous/next buttons plus numbered pages, disabled at the ends, with a `Mostrando N de M` label. Never infinite scroll. |
| `LoadMore` | every mobile list | `Mostrando N de M` caption and a full-width **Carregar mais** button; the button disappears when `shown === total`. |
| `CharacterTileGrid` | Dashboard, Extra Study | Hanzi-only square tiles (no pinyin, no meaning), 54px desktop / 44px mobile, fluid `w-full` inside the grid, group-coloured bottom border, ghost/bolt badges shrunk to fit. The dashboard variant ends in a dashed **+** tile that appends the next batch. |
| `SrsHalfPie` | Dashboard | HanziHero-style 180° ring split by the five display groups in `GROUP_COLOR` order, total in the centre, two-column count legend underneath; 224px desktop / 160px mobile; renders an empty ring at zero items. |
| `SrsStageChip` | item list, item detail, dashboard, practice header | The single place the five display-group colours meet their labels. |
| `PracticeDock` | Lesson, Review, Practice | The four note keys with hotkey chip, SRS hint and a 4px stage-hue left bar; the chosen key fills with its stage hue and keeps the white ring, the others recede in label only; rollback and advance sit with it. Mobile renders one 44px row of keys plus a full-width advance button. |
| `StrokePlayer` | practice (`info` phase, `revealed` swap), item detail | Renders exactly one character, fixed square (175px desktop / 150px mobile), with a **44×44 character picker** above it whenever the item has more than one character, a per-character counter (`4/7 · traço 1/6`) and ◀ ▶ stepping that character's strokes. Switching characters never resizes the box. |
| `FlipCards` | practice prompt/revealed | One tile per character occurrence (duplicate glyphs keyed per occurrence), shrinking per character to a 56px floor, then wrapping into balanced rows; tile radius follows the proportional rule. |
| `WordInspector` | Reading desktop rail | Persistent word detail: hanzi, tone-coloured pinyin, POS, definitions, extra-word flag, **Adicionar ao estudo** with a `Na fila` state; never covers the text. |
| `WordSheet` | Reading mobile | The same content as a sticky bottom card with safe-area padding and a dismiss affordance. |
| `ChartAxes` | Dashboard learned chart, item trajectory | X axis with date labels and Y axis ticks rendered as HTML beside/below the plot; no letterboxing. The item trajectory version draws two Y axes (stability days, difficulty 1–10). |
| `Skeleton` / `EmptyState` / `Toast` | every surface | Per-panel loading and empty states; toast for rollback and safe transient feedback; destructive actions use an inline confirmation or an undo toast. |

## Pagination

Settled once, applied everywhere: explicit page controls on desktop tables and grids, a
**Carregar mais** button on mobile lists. Infinite scroll is never used.

| Surface | Desktop | Mobile | API |
| --- | --- | --- | --- |
| Dashboard character grid | **+** tile appends 12, `Mostrando N de M` | same, 12 at a time | `GET /study-items?limit=12&offset=N` (`&leech=true` for Sanguessugas) |
| Biblioteca item list | pager, 24 per page | load more | `GET /study-items?limit=24&offset=N` |
| Dictionary search | pager, 5 per page | load more | `GET /dictionary-entries?q=&limit=5&offset=N` |
| Batch import results | pager over the bounded report, 12 per page | load more | `POST /study-items/batch` array (no new endpoint) |
| Reading history | pager at the bottom of the rail, 8 per page | load more | `GET /reading-texts?limit=8&offset=N` |
| Related entries | pager, 8 per page | load more | `GET /dictionary-entries/{id}/related?limit=8&offset=N` |
| Readings containing a word | bounded internal scroll in a fixed-height list | same list, inline detail | `GET /reading-texts?entry_id=&limit=&offset=` |

The dashboard character grid is the one exception to desktop page controls, because it is a
daily-queue surface rather than a browsing surface. Both presentations are client-side
renderings of the same `limit`/`offset`/`total`; the server has no "load more" mode, and the
page's order is authoritative — the client never re-sorts.

## Mobile interaction rules

One rule for all surfaces the prototypes settled, plus the general shell rule:

- **Tap only.** No swipe gestures anywhere, including practice grading. Rollback is an
  explicit ↩ control in the practice top bar; advance is a button.
- **44px minimum targets.** Grade keys, character-picker keys, tab items and toolbar icons
  are at least 44×44 CSS pixels.
- **Safe area.** The mobile header pads with `max(<base>, env(safe-area-inset-top))`; any
  bottom-docked element (practice dock, reading word card) pads with
  `env(safe-area-inset-bottom)` and shows the home-indicator bar beneath it.
- **Segments, not hidden panes.** A desktop multi-pane surface becomes segments (Reading:
  Leitura / Histórico / Painéis) or an inline expander (item readings); it never hides
  content behind an undiscoverable gesture.
- **Sticky bottom card for transient detail.** Reading word detail is a bottom card; the
  practice dock is permanently docked, not summoned.

## Surface layouts

### Hoje (Dashboard)

Adopted from [Prototype: Dashboard](https://github.com/luiznaac/shougong/issues/107)
(variant A, "Fila de hoje").

Desktop: two columns, `lg:grid-cols-[1.7fr_1fr]`, main column left, sticky rail right.

1. **Sua fila de hoje** — hero panel: due count, lesson count, **Começar reviews** (cerise
   gradient) and **Aprender N novas** (slate) actions. Buttons disable at zero.
2. **Caracteres** — `CharacterTileGrid`, hanzi-only, chips **Todas (N)** /
   **Sanguessugas (N)**, **+** tile, `Mostrando N de M`.
3. **Itens aprendidos** — full main-column-width chart, 176px desktop, X axis with date
   ticks and Y axis `0 / 64 / 128`, labels as HTML beside the plot.
4. **Estudo extra** — bucket chips (Erros recentes / Aprendidos), up to four hanzi tiles of
   the active bucket, and the **Praticar** action.

Right rail: **SRS Stages** half-pie (224px) then **Próximas revisões** (`next_seven_days`,
seven rows, day + count, with a quiet bar).

Mobile order: actions → Caracteres → Itens aprendidos → Estudo extra → SRS Stages →
Próximas revisões. Every grid is fluid at 4–5 columns and nothing overlaps.

### Biblioteca

Three routes under one section: **Itens** (index + item detail), **Adicionar** (dictionary
search), **Importar CSV**. The Add/Import surface is settled by
[Prototype: Add items and Batch import](https://github.com/luiznaac/shougong/issues/108)
(variant A, "Lado a lado"); the item index has no prototype and follows the `DataList`,
`Pager`/`LoadMore` and filter-chip rules above, with the current columns, filters and
ordering preserved.

**Adicionar / Importar CSV (desktop)** — one workspace, two panes:

- Left, **Buscar no dicionário**: search field, five results per page with HSK chip,
  per-row enqueue feedback ("Adicionado" flips to "Na fila"), shared queue counter
  (`213 na fila`), pager.
- Right, **Importar CSV**: file chip, live progress (`412 de 1.000`), summary tiles
  (created / skipped / errors), latest rows with status pills, pager (`1–12 de 1.000`), and
  ambiguity candidates inline on the error row so one pick resolves that row without
  blocking the batch.
- Both panes share the queue counter and the same enqueue/status vocabulary; adding is per
  row, never a fire-and-forget toast.

**Mobile** — Adicionar is **search only**: result cards, **Carregar mais**, and a quiet note
that CSV import lives on desktop. Importar CSV has no mobile route.

**Item detail** — adopted from [Prototype: study item detail](https://github.com/luiznaac/shougong/issues/110)
(variant K, "Bento validado"):

- Desktop: identity header (large hanzi, pinyin, priority) → FSRS facts line → main column
  **Trajetória → Leituras com 知道 → Relacionados**, with a sticky right rail holding
  **only Traços**.
- **Trajetória**: chart only, no snapshot list; X axis (dates) and two Y axes — stability
  in days on the left, difficulty 1–10 on the right.
- **Leituras com 知道**: master-detail pane — bounded reading list (internal scroll) above,
  the selected reading's snippet, model and extra-word detail below; mobile expands the
  detail inline under the tapped row.
- **Relacionados**: two-up paged grid, 8 per page with the numeric pager on desktop, a
  single list with **Carregar mais** on mobile.
- Mobile order: identity → FSRS facts → priority → **Ordem dos traços first, open and fully
  visible without scrolling** (compact header block, 104px stroke viewer) → Trajetória
  (300×260 chart with axes) → Leituras → Relacionados.
- Paginated sections live in fixed-size cards, so the page height stays bounded.

### Leitura

Adopted from [Prototype: Reading](https://github.com/luiznaac/shougong/issues/109)
(variant B, "Mesa de leitura").

- Desktop, three panes inside the shell:
  - **Left rail — Histórico**: `#id`, format, topic, extra-word count, date; pager at the
    bottom of the rail (8 per page, `1–8 de 38`) so paging never pushes the article;
    selecting a row loads it into the centre.
  - **Centre — leitura**: one wrapping header bar with the generator controls (format,
    model, extras, attempts, topic, **Gerar leitura**), then the article at the article
    typography above, the meta line, and the extra-word note. The article column is
    `max-w`-bounded.
  - **Right rail — Palavra**: the persistent `WordInspector`, with Vocabulário and Temas as
    collapsed accordions beneath it.
- Mobile: segments **Leitura / Histórico / Painéis**. Leitura shows the article at phone
  width with the generator as a compact **Nova leitura** card below it; tapping a word opens
  the sticky `WordSheet`; Histórico uses **Carregar mais**; Vocabulário and Temas live in
  Painéis.
- Behaviour preserved: history paging maps to the existing `limit`/`offset`, extras and
  tokens mirror `SavedReadingText`, and no scheduling behaviour changes.

### Progresso

Not prototyped; keeps its current content (HSK coverage, vocabulary profile, learning→review
curve, review accuracy) refreshed into the new tokens: `PageHeader`, `Panel`, `ChartAxes`,
`SrsStageChip`, `Skeleton`/`EmptyState`. Aggregates come from `GET /reading-vocabulary`,
`GET /study/overview` and the existing insights routes. Mobile stacks the panels in the same
order and uses `LoadMore` for any list that appears.

### Ajustes

Not prototyped; the existing settings content moved into `Panel`s under the new shell, no
layout invention. Reached from the desktop account chip and from the mobile Mais sheet.

### Practice (Lesson, Review, Practice)

Adopted from [Prototype: Lesson, Review and Practice](https://github.com/luiznaac/shougong/issues/111)
(variant K, "Palco final").

**Desktop** — one bounded 720px stage that fits the viewport:

- Coloured band on top: header row (`SrsIntactChip`, session progress segments, mode), the
  pinyin, the glyph slot, the meaning. Mode band identity: violet (Lição), cerise (Review),
  cyan/sky (Prática) — practice has its own colour.
- The question strip overlaps the band's lower edge.
- Middle area is phase-specific: the paper in `prompt`, the study hint in `info`, and in
  `revealed` the consequence of the chosen note ("Bom · volta em ~3 dias").
- `PracticeDock` at the bottom: four note keys, `↩ Rollback`, keyboard legend, `Próximo`.

**Mobile (390px and up)**:

- The band, question strip and middle area survive; the dock is one row of four 44px note
  keys with a full-width advance button beneath it, and rollback is the ↩ icon in the top bar.
- Safe-area padding top and bottom, home-indicator bar under the dock, tap-only grading.

**One glyph per phase**:

- `info` (Lição): the `StrokePlayer` replaces the cards; the word is never drawn twice.
- `prompt`: hidden `FlipCards` plus the paper.
- `revealed`: the cards are the answer, with no stroke panel beneath them; a **Ver traços →**
  pill swaps the cards for the player in place and **← Cartões** swaps back. The toggle is
  shared by the desktop stage and the phone frame.

**Grade keys** — unselected: `bg-slate-900`, white label, hotkey chip, SRS hint, and a 4px
left bar in the note's stage hue. Selected: the whole key fills with that hue and keeps the
white ring; the other three recede in label only, their bars keeping colour.

**Runner semantics unchanged**: nothing is graded until a note is picked, rollback clears
the note then steps back a phase, Enter is disabled without a note, and summary copy still
comes from `summaryCopy` / `topBarTitle`. Practice stays structurally unrecorded, marked by
the "SRS intacto" chip.

## API contracts

Settled on [Decide the list API contracts](https://github.com/luiznaac/shougong/issues/112).
Build tickets follow the existing hexagonal pattern (domain → port → service → controller →
DTO mirror in `frontend/src/api/types.ts`).

[07-api-gaps.md](07-api-gaps.md) was the earlier wish list; its items are resolved here:
the dashboard aggregate is `GET /study/overview` (not `/dashboard`), the study-item filters
and the related-entries endpoint are specified below, `GET /reading-texts/{id}` is added, and
pagination metadata is the envelope. `DELETE`/`PATCH /study-items/{id}`, `GET /review-logs`
and `POST /characters/strokes/batch` are not required by this redesign and stay unimplemented.

### Shared conventions

- **Envelope** for the redesign's list routes — `GET /study-items`, `GET /dictionary-entries`,
  `GET /dictionary-entries/{id}/related`, `GET /reading-texts`:
  `{ "items": […], "total": 137, "limit": 20, "offset": 0 }`.
  `total` is an exact COUNT of the filtered set; zero results is `200` with `items: []`.
- `limit` is `1..100`, default `20`; `offset >= 0`, default `0`. Per-surface densities are
  in the pagination table. The server has no "load more" mode; the client owns presentation.
- The page's order is authoritative; the client never re-sorts.
- **Left as bare arrays** (no envelope): `GET /study-items/{id}/reviews` and
  `GET /study-items/{id}/history`, with today's `limit` 1..200 default 50 / `offset`.
- **Errors**: invalid filters, enums, `limit`/`offset`, `due_from >= due_to` or an
  out-of-range `tz_offset_minutes` are `422`; unknown study item / entry / reading id is
  `404 resource_not_found`. An unknown `entry_id` *filter* is not a lookup: `200` + empty
  page. The `{ code, detail }` error model is unchanged.

### `GET /study-items`

Optional query parameters; values within one parameter OR, different parameters AND:

| Param | Encoding | Semantics |
| --- | --- | --- |
| `due` | bool, default `false` | Shorthand for `due_to = now`; with an explicit `due_to`, the earlier bound wins. |
| `leech` | bool, default `false` | 3+ `again` in the last ten review logs; keeps worst-first order unless `sort` is given. |
| `state` | repeatable `learning\|review\|relearning` | Any-of. |
| `hsk_level` | repeatable `1..9` or `none` | Any-of; `none` = `hsk_level IS NULL`. |
| `pos_tag` | repeatable raw HSK/ICTCLAS tag (`v`, `n`) | Any-of; matches when the entry's `pos_tags` intersects the set. Not the reading `PartOfSpeech` enum. |
| `search` | trimmed string, min 1 | Case-insensitive substring over `simplified` or `pinyin` (`xue2` matches). |
| `due_from` | ISO instant | `card.due >= due_from` (inclusive). |
| `due_to` | ISO instant | `card.due < due_to` (exclusive). |
| `sort` | enum, default `due_asc` | See below. |

Sorts: `due_asc` = `card_due ASC, id ASC`; `created_desc` = `created_at DESC, id DESC`;
`stability_asc` = `card_stability ASC NULLS LAST, id ASC`. `leech=true` without `sort` is
again-count `DESC`, most recent failure `DESC`, `id ASC`; an explicit `sort` overrides the
leech ordering but not the leech filter. `priority_position` is never an ordering input.

Rows stay `StudyItemResponse`; `is_leech` remains annotated on every row.

### `GET /dictionary-entries`

`q` stays required (min 1); `limit` 1..100 default 20; **`offset` added**. Envelope over
`DictionaryEntryResponse`, ordering unchanged (`char_length(simplified) ASC, id ASC`),
`total` = all entries matching `q`.

### `GET /dictionary-entries/{id}/related` — new

Related = the **shared-character family**: an entry is related when its `simplified` shares
at least one hanzi with the target's, excluding the target and every entry with the same
`simplified` (alternate readings are not related words). `404` for an unknown target;
envelope; row = `DictionaryEntryResponse` + `study_item_id: number | null` (the study item
whose entry is this row, or `null`). Ordering: distinct shared hanzi `DESC`, then
`hsk_level ASC NULLS LAST`, then `char_length(simplified) ASC`, then `id ASC`. No `relation`
field — there is one relation family; semantic neighbours and reading co-occurrence are not
related.

### `GET /reading-texts` — summary rows + entry filter

The list returns `ReadingSummaryResponse` rows, newest first (`created_at DESC, id DESC`),
inside the envelope:

```json
{
  "id": 204,
  "format": "dialogue",
  "topic": "No restaurante",
  "topic_generated": false,
  "model": "openai/gpt-4.1-mini",
  "extra_word_count": 1,
  "token_count": 96,
  "attempt_count": 2,
  "created_at": "2026-11-02T19:12:00Z",
  "preview": "服务员：这个菜很辣。我：知道了，谢谢！…",
  "match": null
}
```

`extra_word_count` is the chosen draft's extra-word count; `token_count` counts stored
tokens (words + punctuation); `attempt_count` is the existing derived value; `preview` is
the first 48 characters of the concatenated token text.

**New `entry_id` filter** (int, optional): readings containing a word token that resolves to
that dictionary entry under the existing hydration rule (studied reading preferred, else the
dictionary's first candidate by id), extra words included; `200` + empty page for an unknown
entry id. With `entry_id`, each row carries
`match: { "before": "…", "hit": "知道", "after": "…" }` — the first occurrence's token slice,
up to 12 tokens on each side, punctuation included, clamped to the article edges. Without
it, `match` is `null`. Tokens, attempts and working sets are not in the list.

**New `GET /reading-texts/{id}`** returns the full `SavedReadingTextResponse` (today's list
shape); `404` for an unknown id. The static `/models` route is registered before `/{id}`.

### `GET /study/overview` — new

One read replacing the client's three full-queue fetches and history page-through; no
pagination, no mutation. `tz_offset_minutes` (default `0`, range `-840..840`, minutes east of
UTC) is used only for day bucketing; due counts compare against the server now.

```json
{
  "new_count": 3,
  "due_count": 24,
  "due_review_count": 21,
  "due_learning_count": 3,
  "item_count": 57,
  "leech_count": 4,
  "srs_distribution": { "novice": 6, "apprentice": 15, "journeyman": 2, "expert": 0, "master": 0 },
  "next_seven_days": [{ "date": "2026-11-12", "due": 8 }],
  "learned": { "total": 45, "points": [{ "date": "2026-09-18", "count": 1 }] }
}
```

- `new_count` — every `learning` item (the lesson queue, no due predicate).
- `due_count` — every item with `card.due <= now`.
- `due_review_count` — due items whose state is not `learning` (`review` + `relearning`).
- `due_learning_count` — `learning` items already due (a subset of `new_count`).
- `item_count` / `leech_count` — all items / all leeches (the grid's M and chip count).
- `srs_distribution` — all items grouped by `stability` with the thresholds already in
  `frontend/src/lib/srs.ts`, five group keys only.
- `next_seven_days` — exactly seven rows from **tomorrow** in the learner's local calendar,
  counting **non-learning** items whose `card.due` falls in `[local midnight, next midnight)`
  (a deliberate change from today's all-items forecast). Overdue items live in
  `due_review_count`, not the forecast.
- `learned` — learning→review transitions from the first transition's local day through
  today, one cumulative point per day (flat when none); no transitions → `total: 0`,
  `points: []`.

### Batch import

No contract change. `POST /study-items/batch` keeps its single bounded report (1..1000 rows,
created/skipped/errors, full `outcomes`, per-row `candidates`). "Lado a lado" pages the
bounded `outcomes` array client-side at 12 per page; `1–12 de 1.000` comes from the array.
Reports stay ephemeral — no batch storage, no migration.

### Unchanged

`GET /dictionary-entries/{id}`, `GET /characters/{character}/strokes`, the study session,
priority, review, history trail, Extra Study, reading generation, models, vocabulary and
topics keep their current shapes. `is_leech` stays derived on read, never stored. The
frontend mirror `frontend/src/api/types.ts` changes in the same commit as each backend DTO.

## Build tickets

Each contract group is an independent child of the map, with no blocking edges between them:

- **Build: study item and dictionary list contracts** — envelope + filters + sort on
  `GET /study-items`, envelope + `offset` on `GET /dictionary-entries`, plus the mirror and
  `docs/04-api.md`.
- **Build: related entries endpoint** — `GET /dictionary-entries/{id}/related`.
- **Build: reading list contracts** — summary DTO + envelope, `entry_id` filter + `match`,
  `GET /reading-texts/{id}`, plus the mirror and docs.
- **Build: study overview aggregate** — `GET /study/overview`.

## Follow-ups

- **Rollout sequencing** is decided by
  [Decide the visual-refresh rollout sequencing](https://github.com/luiznaac/shougong/issues/114):
  token switch vs surface-by-surface migration, the trunk-shippable checkpoint, and the
  order the shared components are extracted in.
- **Surfaces without a prototype** — the Biblioteca item index, Progresso and Ajustes follow
  the layout and component rules above; if their layouts need validation beyond those rules,
  that is a new prototype ticket, not a change to this spec.
- **Frontend implementation** of everything above is outside this map, whose build tickets
  deliver the API contracts only.
- **Accessibility conformance** is explicitly out of scope for the redesign effort; the
  current keyboard-reachable practice controls and `prefers-reduced-motion` behaviour are
  preserved, nothing more.

## Prototype references

Adopted prototypes live on throwaway branches; nothing merges from them.

| Ticket | Branch |
| --- | --- |
| [Prototype: app shell, navigation and visual refresh](https://github.com/luiznaac/shougong/issues/105) | `prototype/105-app-shell` |
| [Prototype: Dashboard](https://github.com/luiznaac/shougong/issues/107) | `prototype/107-dashboard` |
| [Prototype: Add items and Batch import](https://github.com/luiznaac/shougong/issues/108) | `prototype/108-add-import` |
| [Prototype: Reading](https://github.com/luiznaac/shougong/issues/109) | `prototype/109-reading` |
| [Prototype: study item detail](https://github.com/luiznaac/shougong/issues/110) | `prototype/110-item-detail` |
| [Prototype: Lesson, Review and Practice](https://github.com/luiznaac/shougong/issues/111) | `prototype/111-practice` |

Run any of them with `cd frontend && npm run dev`; the prototype routes are under
`/prototype/*` and the variant switcher is dev-only. The research note behind the shell
decision is on `research/study-app-shell-ux` (`docs/research/study-app-shell-ux.md`).
