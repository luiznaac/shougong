// PROTOTYPE (wayfinder ticket #107) — Variant C "Fluxo focado".
// One centred column that reads as a single "what now" stream: one continue
// card, then collapsible sections. Deliberately low-density; the same order at
// every width, so mobile is the design rather than its fallback.

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
import {
  AppChrome,
  CharTile,
  MobileChrome,
  PLACEHOLDER_KEYS,
  Skeleton,
  Sparkline,
} from "../parts.tsx";

type Filter = "all" | "leeches";
type Props = { state: DashboardState };

const SECTION =
  "rounded-2xl border border-white/10 bg-slate-900/40 [&>summary]:cursor-pointer " +
  "[&>summary]:list-none [&>summary::-webkit-details-marker]:hidden";

function SectionHead({
  title,
  meta,
  open,
}: {
  title: string;
  meta: string;
  open?: boolean;
}) {
  return (
    <summary className="flex items-center gap-3 px-5 py-4">
      <span className="text-sm font-medium text-slate-200">{title}</span>
      <span className="text-[11px] text-slate-500">{meta}</span>
      <Icon
        name="chevron-right"
        className={`ml-auto h-4 w-4 text-slate-600 transition-transform ${open ? "rotate-90" : ""}`}
      />
    </summary>
  );
}

function Segmented({
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
  return (
    <div className="flex overflow-hidden rounded-full border border-white/10 text-[11px]">
      {(
        [
          ["all", `Todas ${allCount}`],
          ["leeches", `Sanguessugas ${leechCount}`],
        ] as const
      ).map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`px-3 py-1 font-medium ${
            filter === key ? "bg-accent-500/20 text-accent-300" : "text-slate-400"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function StackedSrs({ tally, empty }: { tally: Record<SrsGroup, number>; empty: boolean }) {
  const total = Math.max(
    1,
    GROUP_ORDER.reduce((n, g) => n + tally[g], 0),
  );
  return (
    <div className="space-y-3">
      <div className="flex h-3 overflow-hidden rounded-full bg-white/5">
        {GROUP_ORDER.map((g) =>
          tally[g] === 0 ? null : (
            <div
              key={g}
              style={{ width: `${(tally[g] / total) * 100}%`, background: GROUP_COLOR[g] }}
            />
          ),
        )}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">
        {GROUP_ORDER.map((g) => (
          <span key={g} className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span className="h-2 w-2 rounded-full" style={{ background: GROUP_COLOR[g] }} />
            {GROUP_LABEL[g]}
            <span className="tabular-nums text-slate-300">{empty ? 0 : tally[g]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function ContinueCard({ state }: { state: DashboardState }) {
  const empty = state === "empty";
  const loading = state === "loading";
  const counts = empty ? { reviews: 0, lessons: 0 } : DASH_COUNTS;
  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/30 p-6 ring-1 ring-white/10">
      <div className="absolute -left-20 -top-24 h-56 w-56 rounded-full bg-accent-500/10 blur-3xl" />
      <p className="text-xs uppercase tracking-wide text-slate-500">Sua fila de hoje</p>
      {loading ? (
        <div className="mt-4 space-y-3">
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : (
        <>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-4xl font-semibold tabular-nums text-white">{counts.reviews}</span>
            <span className="text-sm text-slate-400">reviews</span>
            <span className="mx-1 text-slate-600">·</span>
            <span className="text-xl font-semibold tabular-nums text-slate-300">
              {counts.lessons}
            </span>
            <span className="text-sm text-slate-400">lições</span>
          </div>
          <button
            type="button"
            disabled={counts.reviews === 0}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-accent-600 py-3.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            Continuar reviews <Icon name="arrow-right" className="h-4 w-4" />
          </button>
          <div className="mt-3 flex items-center justify-between text-[11px]">
            <button
              type="button"
              disabled={counts.lessons === 0}
              className="text-slate-300 disabled:opacity-40"
            >
              Aprender {counts.lessons} novas →
            </button>
            <span className="text-slate-500">
              {empty ? "Nada na fila" : `24 de ${counts.reviews + counts.lessons} de hoje`}
            </span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/5">
            <div className="h-full w-full rounded-full bg-accent-500/60" />
          </div>
        </>
      )}
    </section>
  );
}

function DesktopDashboard({ state }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(12);
  const loading = state === "loading";
  const empty = state === "empty";
  const items = empty ? [] : DASH_ITEMS;
  const leeches = empty ? [] : DASH_LEECHES;
  const active = filter === "leeches" ? leeches : items;
  const visible = active.slice(0, shown);
  const tally = (
    empty ? { novice: 0, apprentice: 0, journeyman: 0, expert: 0, master: 0 } : DASH_TALLY
  ) as Record<SrsGroup, number>;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Terça, 10 de novembro</p>
          <h1 className="mt-1 text-2xl font-semibold text-white">Bom dia.</h1>
        </div>
        <span className="text-xs text-slate-500">🔥 {empty ? 0 : DASH_COUNTS.streak} dias</span>
      </div>

      <div className="space-y-3">
        <ContinueCard state={state} />

        <details className={SECTION} open>
          <SectionHead
            title="Estudo extra"
            meta={empty ? "nada no período" : "4 erros · 5 aprendidos"}
            open
          />
          <div className="space-y-4 px-5 pb-5">
            {loading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <>
                <div className="flex items-center gap-1">
                  <span className="rounded-full border border-accent-500 bg-accent-500/15 px-3 py-1 text-[11px] text-accent-300">
                    Erros recentes ({empty ? 0 : EXTRA_STUDY.recent_mistakes.length})
                  </span>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-[11px] text-slate-400">
                    Aprendidos ({empty ? 0 : EXTRA_STUDY.recently_learned.length})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {empty ? (
                    <p className="text-xs text-slate-500">Nenhum erro no período.</p>
                  ) : (
                    EXTRA_STUDY.recent_mistakes
                      .slice(0, 4)
                      .map((item) => <CharTile key={item.hanzi} item={item} compact />)
                  )}
                  <button
                    type="button"
                    disabled={empty}
                    className="ml-auto rounded-lg bg-accent-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-40"
                  >
                    Praticar
                  </button>
                </div>
              </>
            )}
          </div>
        </details>

        <details className={SECTION} open>
          <SectionHead
            title="Distribuição SRS"
            meta={`${empty ? 0 : DASH_ITEMS.length} itens`}
            open
          />
          <div className="px-5 pb-5">
            {loading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <StackedSrs tally={tally} empty={empty} />
            )}
          </div>
        </details>

        <details className={SECTION}>
          <SectionHead
            title="Próximas revisões"
            meta={empty ? "0 em 7 dias" : `${UPCOMING_TOTAL} em 7 dias`}
          />
          <div className="space-y-2 px-5 pb-5">
            {loading ? (
              <Skeleton className="h-20 w-full" />
            ) : (
              UPCOMING.map((d) => (
                <div key={d.day} className="flex items-center gap-2 text-[11px]">
                  <span className="w-14 text-slate-500">{d.day}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-accent-500/70"
                      style={{ width: `${(d.count / 11) * 100}%` }}
                    />
                  </div>
                  <span className="w-4 text-right tabular-nums text-slate-400">
                    {empty ? 0 : d.count}
                  </span>
                </div>
              ))
            )}
          </div>
        </details>

        <details className={SECTION}>
          <SectionHead
            title="Itens aprendidos"
            meta={empty ? "nenhum ainda" : `${DASH_COUNTS.learned} no total`}
          />
          <div className="px-5 pb-5">
            {loading ? (
              <Skeleton className="h-20 w-full" />
            ) : empty ? (
              <p className="text-xs text-slate-500">Nenhum item aprendido ainda.</p>
            ) : (
              <Sparkline series={LEARNED_SERIES} className="h-24 w-full" />
            )}
          </div>
        </details>

        <details className={SECTION} open>
          <SectionHead
            title="Caracteres"
            meta={`${shown > active.length ? active.length : shown} de ${active.length}`}
            open
          />
          <div className="px-5 pb-5">
            <div className="mb-3">
              <Segmented
                filter={filter}
                onChange={(f) => {
                  setFilter(f);
                  setShown(12);
                }}
                allCount={items.length}
                leechCount={leeches.length}
              />
            </div>
            {loading ? (
              <div className="grid grid-cols-3 gap-2">
                {PLACEHOLDER_KEYS.slice(0, 9).map((key) => (
                  <Skeleton key={key} className="h-24 w-full" />
                ))}
              </div>
            ) : active.length === 0 ? (
              <p className="text-xs text-slate-500">
                {empty ? "Nada ainda. Adicione seus primeiros caracteres." : "Nenhum sanguessuga."}
              </p>
            ) : (
              <>
                <div className="grid grid-cols-3 justify-items-center gap-2 sm:grid-cols-4">
                  {visible.map((item) => (
                    <CharTile key={item.hanzi} item={item} fluid />
                  ))}
                </div>
                {shown < active.length ? (
                  <button
                    type="button"
                    onClick={() => setShown((n) => n + 12)}
                    className="mt-4 w-full rounded-lg border border-white/10 py-2 text-xs font-medium text-slate-300"
                  >
                    Carregar mais ({visible.length} de {active.length})
                  </button>
                ) : null}
              </>
            )}
          </div>
        </details>
      </div>
    </main>
  );
}

function MobileDashboard({ state }: Props) {
  const [filter, setFilter] = useState<Filter>("all");
  const [shown, setShown] = useState(8);
  const loading = state === "loading";
  const empty = state === "empty";
  const items = empty ? [] : DASH_ITEMS;
  const leeches = empty ? [] : DASH_LEECHES;
  const active = filter === "leeches" ? leeches : items;
  const visible = active.slice(0, shown);
  const counts = empty ? { reviews: 0, lessons: 0 } : DASH_COUNTS;
  const tally = (
    empty ? { novice: 0, apprentice: 0, journeyman: 0, expert: 0, master: 0 } : DASH_TALLY
  ) as Record<SrsGroup, number>;

  return (
    <div className="space-y-3 p-3">
      <div className="sticky top-0 z-10 -mx-3 -mt-3 border-b border-white/10 bg-slate-950/95 px-3 py-2 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-slate-500">Ter, 10 nov</p>
            <p className="text-sm font-semibold text-white">Bom dia</p>
          </div>
          <button
            type="button"
            disabled={counts.reviews === 0}
            className="rounded-lg bg-accent-500 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40"
          >
            Continuar · {counts.reviews}
          </button>
        </div>
      </div>

      <section className="rounded-xl bg-gradient-to-br from-slate-900 to-slate-900/30 p-4 ring-1 ring-white/10">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold tabular-nums text-white">{counts.reviews}</span>
          <span className="text-[11px] text-slate-400">reviews</span>
          <span className="text-slate-600">·</span>
          <span className="text-lg font-semibold tabular-nums text-slate-300">
            {counts.lessons}
          </span>
          <span className="text-[11px] text-slate-400">lições</span>
        </div>
        <button
          type="button"
          disabled={counts.lessons === 0}
          className="mt-3 text-[11px] text-slate-300 disabled:opacity-40"
        >
          Aprender {counts.lessons} novas →
        </button>
      </section>

      <details className="rounded-xl border border-white/10 bg-slate-900/40 px-4 py-3">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-slate-200">
          Estudo extra <span className="text-[10px] text-slate-500">4 erros</span>
          <Icon name="chevron-right" className="ml-auto h-3.5 w-3.5 text-slate-600" />
        </summary>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            disabled={empty}
            className="rounded bg-accent-500 px-3 py-1.5 text-[10px] font-semibold text-white disabled:opacity-40"
          >
            Praticar
          </button>
          <span className="text-[10px] text-slate-500">
            Erros recentes ({empty ? 0 : 4}) · Aprendidos ({empty ? 0 : 5})
          </span>
        </div>
      </details>

      <details className="rounded-xl border border-white/10 bg-slate-900/40 px-4 py-3">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-slate-200">
          Distribuição SRS
          <Icon name="chevron-right" className="ml-auto h-3.5 w-3.5 text-slate-600" />
        </summary>
        <div className="mt-3">
          <StackedSrs tally={tally} empty={empty} />
        </div>
      </details>

      <details className="rounded-xl border border-white/10 bg-slate-900/40 px-4 py-3">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-slate-200">
          Próximas revisões
          <span className="text-[10px] text-slate-500">{empty ? 0 : UPCOMING_TOTAL} em 7 d</span>
          <Icon name="chevron-right" className="ml-auto h-3.5 w-3.5 text-slate-600" />
        </summary>
        <div className="mt-3 space-y-1.5">
          {UPCOMING.slice(0, 4).map((d) => (
            <div key={d.day} className="flex items-center gap-2 text-[10px]">
              <span className="w-12 text-slate-500">{d.day}</span>
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full bg-accent-500/70"
                  style={{ width: `${(d.count / 11) * 100}%` }}
                />
              </div>
              <span className="w-4 text-right tabular-nums text-slate-400">
                {empty ? 0 : d.count}
              </span>
            </div>
          ))}
        </div>
      </details>

      <details className="rounded-xl border border-white/10 bg-slate-900/40 px-4 py-3">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-medium text-slate-200">
          Itens aprendidos
          <span className="text-[10px] text-slate-500">{empty ? 0 : DASH_COUNTS.learned}</span>
          <Icon name="chevron-right" className="ml-auto h-3.5 w-3.5 text-slate-600" />
        </summary>
        <div className="mt-3">
          {loading ? (
            <Skeleton className="h-12 w-full" />
          ) : empty ? (
            <p className="text-[10px] text-slate-500">Nenhum item aprendido ainda.</p>
          ) : (
            <Sparkline series={LEARNED_SERIES} className="h-12 w-full" />
          )}
        </div>
      </details>

      <section className="rounded-xl border border-white/10 bg-slate-900/40 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-200">Caracteres</span>
          <Segmented
            filter={filter}
            onChange={(f) => {
              setFilter(f);
              setShown(8);
            }}
            allCount={items.length}
            leechCount={leeches.length}
          />
        </div>
        {loading ? (
          <div className="grid grid-cols-2 gap-2">
            {PLACEHOLDER_KEYS.slice(0, 6).map((key) => (
              <Skeleton key={key} className="h-20 w-full" />
            ))}
          </div>
        ) : active.length === 0 ? (
          <p className="text-[10px] text-slate-500">
            {empty ? "Nada ainda. Adicione seus primeiros caracteres." : "Nenhum sanguessuga."}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 justify-items-center gap-2">
              {visible.map((item) => (
                <CharTile key={item.hanzi} item={item} fluid />
              ))}
            </div>
            {shown < active.length ? (
              <button
                type="button"
                onClick={() => setShown((n) => n + 8)}
                className="mt-3 w-full rounded-lg border border-white/10 py-2 text-[11px] font-medium text-slate-300"
              >
                Carregar mais ({visible.length} de {active.length})
              </button>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}

export function FocusDashboard({ state }: Props) {
  return (
    <>
      <AppChrome>
        <DesktopDashboard state={state} />
      </AppChrome>
      <div className="mx-auto max-w-6xl border-t border-white/10 px-6 py-10">
        <h2 className="mb-6 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Mobile — a mesma pilha, com um cabeçalho fixo de "Continuar"
        </h2>
        <PhoneFrame caption="Uma coluna só: continuar, depois seções recolhíveis. Grid de caracteres em 2 colunas com 'Carregar mais'.">
          <MobileChrome>
            <MobileDashboard state={state} />
          </MobileChrome>
        </PhoneFrame>
      </div>
    </>
  );
}
