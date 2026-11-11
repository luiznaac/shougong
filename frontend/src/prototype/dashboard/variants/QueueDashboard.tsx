// PROTOTYPE (wayfinder ticket #107) — Variant A "Fila de hoje", revision 4.
// Adopted direction. Main column on the left: today's queue, the character grid,
// the learned chart, then Extra Study. A sticky right rail carries the SRS
// Stages half-pie and Upcoming Reviews. Hanzi-only character tiles; the grid
// grows with a HanziHero-style "+" tile at both widths (no paging).

import { useState } from "react";
import { GROUP_COLOR, GROUP_LABEL, GROUP_ORDER, type SrsGroup } from "../../../lib/srs.ts";
import { PhoneFrame } from "../../PhoneFrame.tsx";
import { Icon } from "../../icons.tsx";
import {
  DASH_COUNTS,
  DASH_ITEMS,
  DASH_LEECHES,
  DASH_TALLY,
  type DashboardState,
  EXTRA_STUDY,
  LEARNED_SERIES,
  UPCOMING,
  UPCOMING_TOTAL,
} from "../dashboardData.ts";
import { AppChrome, CharTile, MobileChrome, PLACEHOLDER_KEYS, Panel, Skeleton } from "../parts.tsx";

type Filter = "all" | "leeches";
type Props = { state: DashboardState };

const PAGE_SIZE = 12;
const MOBILE_STEP = 12;

function FilterChips({
  filter,
  onChange,
  allCount,
  leechCount,
}: {
  filter: Filter;
  onChange: (f: Filter) => void;
  allCount: number;
  leechCount: number;
}) {
  const chip = (pressed: boolean) =>
    `rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
      pressed
        ? "border-accent-500 bg-accent-500/15 text-accent-300"
        : "border-white/10 text-slate-400 hover:text-slate-200"
    }`;
  return (
    <div className="flex gap-1">
      <button type="button" className={chip(filter === "all")} onClick={() => onChange("all")}>
        Todas ({allCount})
      </button>
      <button
        type="button"
        className={chip(filter === "leeches")}
        onClick={() => onChange("leeches")}
      >
        Sanguessugas ({leechCount})
      </button>
    </div>
  );
}

/** HanziHero-style SRS Stages half-pie: a semicircle donut, one arc per group. */
function SrsStages({
  tally,
  empty,
  compact = false,
}: {
  tally: Record<SrsGroup, number>;
  empty: boolean;
  compact?: boolean;
}) {
  const total = GROUP_ORDER.reduce((n, g) => n + tally[g], 0);
  let acc = 0;
  const arc = "M 22 96 A 78 78 0 0 1 178 96";
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 104" className={compact ? "w-40" : "w-56"}>
        <title>Distribuição dos estágios SRS</title>
        <path d={arc} fill="none" stroke="#1e293b" strokeWidth={30} />
        {GROUP_ORDER.map((g) => {
          const frac = total === 0 ? 0 : tally[g] / total;
          const offset = acc;
          acc += frac;
          if (frac === 0) return null;
          return (
            <path
              key={g}
              d={arc}
              pathLength={100}
              fill="none"
              stroke={GROUP_COLOR[g]}
              strokeWidth={30}
              strokeDasharray={`${frac * 100} 100`}
              strokeDashoffset={-offset * 100}
            />
          );
        })}
        <text
          x="100"
          y="70"
          textAnchor="middle"
          className="fill-slate-100"
          fontSize="26"
          fontWeight="600"
        >
          {total}
        </text>
        <text x="100" y="86" textAnchor="middle" className="fill-slate-500" fontSize="9">
          itens
        </text>
      </svg>
      <div className="mt-2 grid w-full grid-cols-2 gap-x-4 gap-y-1">
        {GROUP_ORDER.map((g) => (
          <span key={g} className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span className="h-2 w-2 rounded-full" style={{ background: GROUP_COLOR[g] }} />
            {GROUP_LABEL[g]}
            <span className="ml-auto tabular-nums text-slate-300">{empty ? 0 : tally[g]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function UpcomingRows({ limit }: { limit?: number }) {
  const rows = limit ? UPCOMING.slice(0, limit) : UPCOMING;
  const max = Math.max(1, ...UPCOMING.map((d) => d.count));
  return (
    <div className="space-y-1.5">
      {rows.map((d) => (
        <div key={d.day} className="flex items-center gap-2 text-[11px]">
          <span className="w-12 text-slate-500">{d.day}</span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-accent-500/70"
              style={{ width: `${(d.count / max) * 100}%` }}
            />
          </div>
          <span className="w-4 text-right tabular-nums text-slate-400">{d.count}</span>
        </div>
      ))}
    </div>
  );
}

/** Cumulative learned chart — full width, taller, with drawn X and Y axes. */
function LearnedChart({ height = 176 }: { height?: number }) {
  const max = Math.max(...LEARNED_SERIES);
  const points = LEARNED_SERIES.map(
    (v, i) => `${(i / (LEARNED_SERIES.length - 1)) * 100},${100 - (v / max) * 100}`,
  ).join(" ");
  const ticks = [max, Math.round(max / 2), 0];

  return (
    <div className="mt-3 flex gap-2">
      <div
        className="flex flex-col justify-between text-right text-[10px] tabular-nums text-slate-500"
        style={{ height }}
      >
        {ticks.map((t) => (
          <span key={t}>{t}</span>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height }} className="w-full">
          <title>Itens aprendidos ao longo do tempo</title>
          {[0, 50, 100].map((y) => (
            <line
              key={y}
              x1="0"
              x2="100"
              y1={y}
              y2={y}
              stroke="rgba(255,255,255,0.07)"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <polygon
            points={`0,100 ${points} 100,100`}
            fill="var(--color-accent-500)"
            fillOpacity="0.15"
          />
          <polyline
            points={points}
            fill="none"
            stroke="var(--color-accent-500)"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1="0"
            x2="0"
            y1="0"
            y2="100"
            stroke="rgba(255,255,255,0.18)"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1="0"
            x2="100"
            y1="100"
            y2="100"
            stroke="rgba(255,255,255,0.18)"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div className="mt-1 flex justify-between text-[10px] text-slate-500">
          <span>14 out</span>
          <span className="hidden sm:inline">outubro — novembro</span>
          <span>10 nov</span>
        </div>
      </div>
    </div>
  );
}

/** HanziHero-style "+" tile: appends the next batch instead of paging. */
function AddMoreTile({
  onClick,
  compact = false,
  fluid = false,
}: {
  onClick: () => void;
  compact?: boolean;
  fluid?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Carregar mais caracteres"
      title="Carregar mais"
      className={`grid place-items-center rounded-lg border border-dashed border-white/15 text-slate-500 transition-colors hover:border-accent-500/60 hover:text-accent-300 ${
        fluid ? "h-[52px] w-full min-w-0" : compact ? "h-11 w-11" : "h-[54px] w-[54px]"
      }`}
    >
      <Icon name="plus" className={compact ? "h-4 w-4" : "h-5 w-5"} />
    </button>
  );
}

function ExtraStudyStrip({ empty }: { empty: boolean }) {
  const mistakes = empty ? 0 : EXTRA_STUDY.recent_mistakes.length;
  const learned = empty ? 0 : EXTRA_STUDY.recently_learned.length;
  return (
    <div className="space-y-3">
      <div className="flex gap-1">
        <span className="rounded-full border border-accent-500 bg-accent-500/15 px-3 py-1 text-xs font-medium text-accent-300">
          Erros recentes ({mistakes})
        </span>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-400">
          Aprendidos ({learned})
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {empty ? (
          <p className="text-xs text-slate-500">Nenhum erro no período.</p>
        ) : (
          EXTRA_STUDY.recent_mistakes.map((item) => (
            <CharTile key={item.hanzi} item={item} compact />
          ))
        )}
        <button
          type="button"
          disabled={mistakes === 0}
          className="ml-auto rounded-md bg-accent-500 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
        >
          Praticar
        </button>
      </div>
    </div>
  );
}

function DesktopDashboard({ state }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(PAGE_SIZE);
  const loading = state === "loading";
  const empty = state === "empty";
  const items = empty ? [] : DASH_ITEMS;
  const leeches = empty ? [] : DASH_LEECHES;
  const active = filter === "leeches" ? leeches : items;
  const visible = active.slice(0, shown);
  const counts = empty ? { lessons: 0, reviews: 0, streak: 0 } : DASH_COUNTS;
  const tally = (
    empty ? { novice: 0, apprentice: 0, journeyman: 0, expert: 0, master: 0 } : DASH_TALLY
  ) as Record<SrsGroup, number>;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Terça, 10 de novembro</p>
            <h1 className="mt-1 text-2xl font-semibold text-white">Bom dia. Vamos estudar.</h1>
          </div>
          <span className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs text-slate-400">
            🔥 {counts.streak} dias seguidos
          </span>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          {/* Main column — the daily loop and everything worked through. */}
          <div className="space-y-4">
            <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/40 p-6 ring-1 ring-white/10">
              <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-accent-500/10 blur-3xl" />
              <p className="text-sm text-slate-400">Sua fila de hoje</p>
              {loading ? (
                <div className="mt-4 space-y-4">
                  <Skeleton className="h-12 w-2/3" />
                  <Skeleton className="h-11 w-72" />
                </div>
              ) : (
                <>
                  <div className="mt-2 flex items-baseline gap-6">
                    <span className="text-5xl font-semibold tabular-nums text-white">
                      {counts.reviews}
                    </span>
                    <span className="text-sm text-slate-400">reviews</span>
                    <span className="text-3xl font-semibold tabular-nums text-slate-300">
                      {counts.lessons}
                    </span>
                    <span className="text-sm text-slate-400">lições novas</span>
                  </div>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={counts.reviews === 0}
                      className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-accent-600 px-5 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-40"
                    >
                      Começar reviews <Icon name="arrow-right" className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={counts.lessons === 0}
                      className="flex items-center gap-2 rounded-xl bg-slate-800 px-5 py-3 text-sm font-semibold text-slate-100 ring-1 ring-white/10 disabled:opacity-40"
                    >
                      Aprender {counts.lessons} novas
                    </button>
                  </div>
                  {empty ? (
                    <p className="mt-4 text-xs text-slate-500">
                      Nada ainda — adicione seus primeiros itens na Biblioteca.
                    </p>
                  ) : null}
                </>
              )}
            </section>

            <Panel
              title="Caracteres"
              action={
                <FilterChips
                  filter={filter}
                  onChange={(f) => {
                    setFilter(f);
                    setShown(PAGE_SIZE);
                  }}
                  allCount={items.length}
                  leechCount={leeches.length}
                />
              }
            >
              {loading ? (
                <div className="flex flex-wrap gap-1.5">
                  {PLACEHOLDER_KEYS.slice(0, 12).map((key) => (
                    <Skeleton key={key} className="h-[54px] w-[54px]" />
                  ))}
                </div>
              ) : empty ? (
                <p className="text-sm text-slate-500">
                  Nada ainda. Adicione itens para ver seus caracteres aqui.
                </p>
              ) : filter === "leeches" && visible.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhum sanguessuga no momento.</p>
              ) : (
                <>
                  <div className="flex flex-wrap gap-1.5">
                    {visible.map((item) => (
                      <CharTile key={item.hanzi} item={item} />
                    ))}
                    {shown < active.length ? (
                      <AddMoreTile onClick={() => setShown((n) => n + PAGE_SIZE)} />
                    ) : null}
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    Mostrando {visible.length} de {active.length}
                  </p>
                </>
              )}
            </Panel>

            <Panel title="Itens aprendidos">
              {loading ? (
                <Skeleton className="h-36 w-full" />
              ) : empty ? (
                <p className="text-sm text-slate-500">Nenhum item aprendido ainda.</p>
              ) : (
                <>
                  <div className="text-sm text-slate-300">
                    <span className="font-semibold tabular-nums text-slate-100">
                      {DASH_COUNTS.learned}
                    </span>{" "}
                    itens aprendidos
                  </div>
                  <LearnedChart />
                </>
              )}
            </Panel>

            <Panel title="Estudo extra">
              {loading ? <Skeleton className="h-20 w-full" /> : <ExtraStudyStrip empty={empty} />}
            </Panel>
          </div>

          {/* Right rail — distribution and what's coming. */}
          <aside className="space-y-4 self-start lg:sticky lg:top-20">
            <Panel
              title="SRS Stages"
              action={<Icon name="layers" className="h-4 w-4 text-slate-600" />}
            >
              {loading ? (
                <Skeleton className="h-32 w-full" />
              ) : (
                <SrsStages tally={tally} empty={empty} />
              )}
            </Panel>

            <Panel
              title="Próximas revisões"
              action={
                <span className="text-[10px] text-slate-500">{UPCOMING_TOTAL} em 7 dias</span>
              }
            >
              {loading ? <Skeleton className="h-24 w-full" /> : <UpcomingRows />}
            </Panel>
          </aside>
        </div>
      </div>
    </main>
  );
}

function MobileDashboard({ state }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(MOBILE_STEP);
  const loading = state === "loading";
  const empty = state === "empty";
  const items = empty ? [] : DASH_ITEMS;
  const leeches = empty ? [] : DASH_LEECHES;
  const active = filter === "leeches" ? leeches : items;
  const visible = active.slice(0, shown);
  const counts = empty ? { lessons: 0, reviews: 0 } : DASH_COUNTS;
  const tally = (
    empty ? { novice: 0, apprentice: 0, journeyman: 0, expert: 0, master: 0 } : DASH_TALLY
  ) as Record<SrsGroup, number>;

  return (
    <div className="space-y-4 p-4">
      <div>
        <p className="text-xs text-slate-500">Ter, 10 nov</p>
        <h1 className="text-xl font-semibold text-white">Bom dia</h1>
        <p className="text-xs text-slate-400">
          {counts.reviews} vencendo hoje · {counts.lessons} lições
        </p>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <div className="space-y-2">
          <button
            type="button"
            disabled={counts.reviews === 0}
            className="flex w-full items-center justify-between rounded-xl bg-gradient-to-r from-rose-500 to-accent-600 px-4 py-4 text-left disabled:opacity-40"
          >
            <span>
              <span className="block text-2xl font-semibold tabular-nums">{counts.reviews}</span>
              <span className="text-xs">Reviews</span>
            </span>
            <Icon name="arrow-right" className="h-5 w-5" />
          </button>
          <button
            type="button"
            disabled={counts.lessons === 0}
            className="flex w-full items-center justify-between rounded-xl bg-slate-800 px-4 py-3 text-left ring-1 ring-white/10 disabled:opacity-40"
          >
            <span>
              <span className="block text-xl font-semibold tabular-nums">{counts.lessons}</span>
              <span className="text-xs">Lições</span>
            </span>
            <Icon name="arrow-right" className="h-5 w-5" />
          </button>
        </div>
      )}

      <div className="rounded-xl bg-slate-900/60 p-3 ring-1 ring-white/5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Caracteres
          </span>
          <FilterChips
            filter={filter}
            onChange={(f) => {
              setFilter(f);
              setShown(MOBILE_STEP);
            }}
            allCount={items.length}
            leechCount={leeches.length}
          />
        </div>
        {loading ? (
          <div className="grid grid-cols-5 gap-1.5">
            {PLACEHOLDER_KEYS.slice(0, 10).map((key) => (
              <Skeleton key={key} className="h-11 w-full" />
            ))}
          </div>
        ) : empty ? (
          <p className="text-[10px] text-slate-500">Adicione itens para vê-los aqui.</p>
        ) : (
          <>
            <div className="grid grid-cols-5 gap-1.5">
              {visible.map((item) => (
                <CharTile key={item.hanzi} item={item} compact fluid />
              ))}
            </div>
            {shown < active.length ? (
              <AddMoreTile compact fluid onClick={() => setShown((n) => n + MOBILE_STEP)} />
            ) : null}
          </>
        )}
      </div>

      <div className="rounded-xl bg-slate-900/60 p-3 ring-1 ring-white/5">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Itens aprendidos
          </span>
          <span className="text-[10px] tabular-nums text-slate-400">{DASH_COUNTS.learned}</span>
        </div>
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : empty ? (
          <p className="text-[10px] text-slate-500">Nenhum item aprendido ainda.</p>
        ) : (
          <LearnedChart height={140} />
        )}
      </div>

      <div className="rounded-xl bg-slate-900/60 p-3 ring-1 ring-white/5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Estudo extra
          </span>
          <button
            type="button"
            disabled={empty}
            className="rounded bg-accent-500 px-2 py-1 text-[10px] font-semibold text-white disabled:opacity-40"
          >
            Praticar
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {empty ? (
            <span className="text-[10px] text-slate-500">Nenhum erro no período.</span>
          ) : (
            EXTRA_STUDY.recent_mistakes.map((item) => (
              <CharTile key={item.hanzi} item={item} compact />
            ))
          )}
        </div>
      </div>

      <div className="rounded-xl bg-slate-900/60 p-3 ring-1 ring-white/5">
        <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          SRS Stages
        </div>
        {loading ? (
          <Skeleton className="h-28 w-full" />
        ) : (
          <SrsStages tally={tally} empty={empty} compact />
        )}
      </div>

      <div className="rounded-xl bg-slate-900/60 p-3 ring-1 ring-white/5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Próximas revisões
          </span>
          <span className="text-[10px] text-slate-500">{UPCOMING_TOTAL} em 7 d</span>
        </div>
        {loading ? <Skeleton className="h-10 w-full" /> : <UpcomingRows limit={4} />}
      </div>
    </div>
  );
}

export function QueueDashboard({ state }: Props) {
  return (
    <>
      <AppChrome>
        <DesktopDashboard state={state} />
      </AppChrome>
      <div className="mx-auto max-w-6xl border-t border-white/10 px-6 py-10">
        <h2 className="mb-6 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Mobile — coluna principal primeiro, rail por último
        </h2>
        <PhoneFrame caption="Ações, caracteres (5 colunas sem sobreposição + tile de carregar mais), gráfico largo com eixos, estudo extra com tiles, SRS Stages e próximas revisões.">
          <MobileChrome>
            <MobileDashboard state={state} />
          </MobileChrome>
        </PhoneFrame>
      </div>
    </>
  );
}
