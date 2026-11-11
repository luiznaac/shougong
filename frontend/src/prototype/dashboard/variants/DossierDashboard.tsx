// PROTOTYPE (wayfinder ticket #107) — Variant B "Dossiê".
// Density-first: no hero, a flat action strip, the character library as a real
// table with page controls, and every metric parked in a right-hand rail.
// Mobile collapses the table into rows and the rail into one "Resumo" drawer.

import { useState } from "react";
import { Hanzi } from "../../../components/Hanzi.tsx";
import { Pinyin } from "../../../components/Pinyin.tsx";
import { GROUP_COLOR, GROUP_LABEL, GROUP_ORDER, type SrsGroup } from "../../../lib/srs.ts";
import { PhoneFrame } from "../../PhoneFrame.tsx";
import { Icon } from "../../icons.tsx";
import {
  DASH_COUNTS,
  DASH_ITEMS,
  DASH_LEECHES,
  DASH_TALLY,
  type DashboardState,
  LEARNED_SERIES,
  UPCOMING,
  UPCOMING_TOTAL,
} from "../dashboardData.ts";
import {
  AppChrome,
  Badge,
  MobileChrome,
  PLACEHOLDER_KEYS,
  Skeleton,
  Sparkline,
} from "../parts.tsx";

type Filter = "all" | "leeches";
type Props = { state: DashboardState };

const PAGE_SIZE = 10;

const flatPanel = "rounded-lg border border-white/10 bg-slate-900/40";

function Toolbar({
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
  const tab = (pressed: boolean) =>
    `px-3 py-1.5 text-xs font-medium ${
      pressed ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200"
    }`;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex overflow-hidden rounded-md border border-white/10">
        <button type="button" className={tab(filter === "all")} onClick={() => onChange("all")}>
          Todas ({allCount})
        </button>
        <button
          type="button"
          className={tab(filter === "leeches")}
          onClick={() => onChange("leeches")}
        >
          Sanguessugas ({leechCount})
        </button>
      </div>
      <span className="ml-auto flex items-center gap-2 rounded-md border border-white/10 px-2 py-1.5 text-xs text-slate-500">
        <Icon name="search" className="h-3.5 w-3.5" />
        Filtrar…
      </span>
      <span className="hidden items-center gap-1 rounded-md border border-white/10 px-2 py-1.5 text-xs text-slate-500 sm:flex">
        10 / página <Icon name="chevron-right" className="h-3 w-3" />
      </span>
    </div>
  );
}

function ActionStrip({ state }: { state: DashboardState }) {
  const empty = state === "empty";
  const rows = [
    { label: "Reviews", count: empty ? 0 : DASH_COUNTS.reviews, icon: "clock", accent: true },
    { label: "Lições", count: empty ? 0 : DASH_COUNTS.lessons, icon: "book", accent: false },
    { label: "Estudo extra", count: empty ? 0 : 4, icon: "spark", accent: false },
  ];
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {rows.map((row) => (
        <button
          key={row.label}
          type="button"
          disabled={row.count === 0}
          className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left disabled:opacity-40 ${
            row.accent
              ? "border-accent-500/40 bg-accent-500/10"
              : "border-white/10 bg-slate-900/40 hover:border-white/20"
          }`}
        >
          <Icon
            name={row.icon}
            className={`h-4 w-4 ${row.accent ? "text-accent-400" : "text-slate-500"}`}
          />
          <span className="text-sm font-medium text-slate-200">{row.label}</span>
          <span className="ml-auto text-lg font-semibold tabular-nums text-white">{row.count}</span>
          <Icon name="chevron-right" className="h-4 w-4 text-slate-600" />
        </button>
      ))}
    </div>
  );
}

function Tablerows({ state }: { state: DashboardState }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const loading = state === "loading";
  const empty = state === "empty";
  const items = empty ? [] : DASH_ITEMS;
  const leeches = empty ? [] : DASH_LEECHES;
  const active = filter === "leeches" ? leeches : items;
  const pages = Math.max(1, Math.ceil(active.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = active.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const from = active.length === 0 ? 0 : (current - 1) * PAGE_SIZE + 1;
  const to = Math.min(current * PAGE_SIZE, active.length);

  return (
    <section className={flatPanel}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-200">Caracteres</h2>
        <Toolbar
          filter={filter}
          onChange={(f) => {
            setFilter(f);
            setPage(1);
          }}
          allCount={items.length}
          leechCount={leeches.length}
        />
      </div>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 text-[10px] uppercase tracking-wide text-slate-500">
            <th className="px-4 py-2 font-medium">Caractere</th>
            <th className="hidden px-2 py-2 font-medium md:table-cell">Significado</th>
            <th className="px-2 py-2 font-medium">Estágio</th>
            <th className="px-4 py-2 text-right font-medium">Próxima</th>
          </tr>
        </thead>
        <tbody>
          {loading
            ? PLACEHOLDER_KEYS.slice(0, 6).map((key) => (
                <tr key={key} className="border-b border-white/5">
                  <td className="px-4 py-3" colSpan={4}>
                    <Skeleton className="h-8 w-full" />
                  </td>
                </tr>
              ))
            : visible.map((item) => (
                <tr key={item.hanzi} className="border-b border-white/5 hover:bg-white/5">
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-2">
                      <Hanzi
                        text={item.hanzi}
                        singleCharPx={22}
                        boxPx={64}
                        className="text-slate-50"
                      />
                      <span className="text-xs">
                        <Pinyin value={item.pinyin} />
                      </span>
                      <span className="flex gap-0.5">
                        {item.leech ? <Badge kind="ghost" /> : null}
                        {item.pinned ? <Badge kind="bolt" /> : null}
                      </span>
                    </span>
                  </td>
                  <td className="hidden px-2 py-2 text-xs text-slate-400 md:table-cell">
                    {item.meaning}
                  </td>
                  <td className="px-2 py-2">
                    <span className="flex items-center gap-1.5 text-xs text-slate-300">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: GROUP_COLOR[item.group] }}
                      />
                      {GROUP_LABEL[item.group]}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right text-xs tabular-nums text-slate-400">
                    {item.due}
                  </td>
                </tr>
              ))}
          {!loading && active.length === 0 ? (
            <tr>
              <td className="px-4 py-10 text-center text-sm text-slate-500" colSpan={4}>
                {empty ? "Nenhum item ainda — adicione seus primeiros caracteres." : "Nada aqui."}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs text-slate-500">
        <span>
          {active.length === 0 ? "0 itens" : `Mostrando ${from}–${to} de ${active.length}`}
        </span>
        <div className="flex items-center gap-1">
          {[
            ["«", () => setPage(1), current === 1],
            ["‹", () => setPage(current - 1), current === 1],
            ["›", () => setPage(current + 1), current === pages],
            ["»", () => setPage(pages), current === pages],
          ].map(([label, act, disabled]) => (
            <button
              key={String(label)}
              type="button"
              onClick={act as () => void}
              disabled={Boolean(disabled)}
              className="grid h-7 w-7 place-items-center rounded border border-white/10 text-slate-400 hover:text-slate-200 disabled:opacity-30"
            >
              {label as string}
            </button>
          ))}
          <span className="ml-2 tabular-nums">
            Página {current} de {pages}
          </span>
        </div>
      </div>
    </section>
  );
}

function SrsBars({ tally }: { tally: Record<SrsGroup, number> }) {
  const max = Math.max(1, ...GROUP_ORDER.map((g) => tally[g]));
  const total = GROUP_ORDER.reduce((n, g) => n + tally[g], 0);
  return (
    <div className="space-y-2">
      {GROUP_ORDER.map((g) => (
        <div key={g} className="grid grid-cols-[64px_1fr_24px] items-center gap-2 text-xs">
          <span className="text-slate-400">{GROUP_LABEL[g]}</span>
          <div className="h-2 overflow-hidden rounded bg-white/5">
            <div
              className="h-full rounded"
              style={{ width: `${(tally[g] / max) * 100}%`, background: GROUP_COLOR[g] }}
            />
          </div>
          <span className="text-right tabular-nums text-slate-300">{tally[g]}</span>
        </div>
      ))}
      <p className="pt-1 text-right text-[10px] text-slate-500">{total} itens</p>
    </div>
  );
}

function Rail({ state }: { state: DashboardState }) {
  const empty = state === "empty";
  const loading = state === "loading";
  const tally = empty
    ? { novice: 0, apprentice: 0, journeyman: 0, expert: 0, master: 0 }
    : DASH_TALLY;
  return (
    <div className="space-y-3">
      <section className={`${flatPanel} p-4`}>
        <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          SRS
        </h3>
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : (
          <SrsBars tally={tally as Record<SrsGroup, number>} />
        )}
      </section>

      <section className={`${flatPanel} p-4`}>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Próximas revisões
          </h3>
          <span className="text-[10px] text-slate-500">{empty ? 0 : UPCOMING_TOTAL}</span>
        </div>
        {loading ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <div className="space-y-1">
            {UPCOMING.slice(0, 5).map((d) => (
              <div key={d.day} className="flex items-center gap-2 text-[11px]">
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
        )}
      </section>

      <section className={`${flatPanel} p-4`}>
        <div className="mb-1 flex items-baseline justify-between">
          <h3 className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Itens aprendidos
          </h3>
          <span className="text-sm font-semibold tabular-nums text-slate-100">
            {empty ? 0 : DASH_COUNTS.learned}
          </span>
        </div>
        {loading ? (
          <Skeleton className="h-16 w-full" />
        ) : empty ? (
          <p className="text-[11px] text-slate-500">Nenhum item aprendido ainda.</p>
        ) : (
          <Sparkline series={LEARNED_SERIES} className="h-16 w-full" />
        )}
      </section>

      <section className={`${flatPanel} p-4`}>
        <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Estudo extra
        </h3>
        <div className="flex gap-1">
          <span className="rounded border border-accent-500/40 bg-accent-500/10 px-2 py-0.5 text-[10px] text-accent-300">
            Erros ({empty ? 0 : 4})
          </span>
          <span className="rounded border border-white/10 px-2 py-0.5 text-[10px] text-slate-400">
            Aprendidos ({empty ? 0 : 5})
          </span>
        </div>
        <button
          type="button"
          disabled={empty}
          className="mt-3 w-full rounded bg-accent-500 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
        >
          Praticar
        </button>
      </section>
    </div>
  );
}

function DesktopDashboard({ state }: Props) {
  return (
    <main className="mx-auto max-w-6xl space-y-4 px-6 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-slate-500">Terça, 10 de novembro</p>
          <h1 className="text-xl font-semibold text-white">Painel</h1>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1.5 text-slate-400">
            🔥 {state === "empty" ? 0 : DASH_COUNTS.streak} dias
          </span>
          <button
            type="button"
            className="rounded-md border border-white/10 px-2.5 py-1.5 text-slate-300"
          >
            Novo item
          </button>
          <button
            type="button"
            className="rounded-md bg-accent-500 px-2.5 py-1.5 font-semibold text-white"
          >
            Importar CSV
          </button>
        </div>
      </div>

      <ActionStrip state={state} />

      <div className="grid gap-3 lg:grid-cols-[1fr_300px]">
        <Tablerows state={state} />
        <Rail state={state} />
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

  return (
    <div className="space-y-3 p-3">
      <div className="sticky top-0 -mx-3 -mt-3 flex gap-1.5 border-b border-white/10 bg-slate-950/95 px-3 py-2 backdrop-blur">
        <button
          type="button"
          disabled={counts.reviews === 0}
          className="flex-1 rounded-md bg-accent-500 px-3 py-2 text-left disabled:opacity-40"
        >
          <span className="block text-lg font-semibold tabular-nums leading-none text-white">
            {counts.reviews}
          </span>
          <span className="text-[10px] text-white/80">Reviews</span>
        </button>
        <button
          type="button"
          disabled={counts.lessons === 0}
          className="flex-1 rounded-md border border-white/10 px-3 py-2 text-left disabled:opacity-40"
        >
          <span className="block text-lg font-semibold tabular-nums leading-none text-slate-100">
            {counts.lessons}
          </span>
          <span className="text-[10px] text-slate-400">Lições</span>
        </button>
      </div>

      <details className="rounded-lg border border-white/10 bg-slate-900/40 px-3 py-2">
        <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Resumo
        </summary>
        <div className="mt-3 space-y-3">
          {loading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <>
              <SrsBars
                tally={
                  (empty
                    ? { novice: 0, apprentice: 0, journeyman: 0, expert: 0, master: 0 }
                    : DASH_TALLY) as Record<SrsGroup, number>
                }
              />
              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span>{empty ? 0 : UPCOMING_TOTAL} reviews em 7 dias</span>
                <span>{empty ? 0 : DASH_COUNTS.learned} itens aprendidos</span>
              </div>
              {empty ? null : <Sparkline series={LEARNED_SERIES} className="h-12 w-full" />}
            </>
          )}
        </div>
      </details>

      <div className="flex overflow-hidden rounded-md border border-white/10">
        {(
          [
            ["all", `Todas (${items.length})`],
            ["leeches", `Sanguessugas (${leeches.length})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => {
              setFilter(key);
              setShown(8);
            }}
            className={`flex-1 py-1.5 text-[11px] font-medium ${
              filter === key ? "bg-white/10 text-white" : "text-slate-400"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <ul className="divide-y divide-white/5 rounded-lg border border-white/10 bg-slate-900/40">
        {loading
          ? PLACEHOLDER_KEYS.slice(0, 5).map((key) => (
              <li key={key} className="px-3 py-2">
                <Skeleton className="h-8 w-full" />
              </li>
            ))
          : visible.map((item) => (
              <li key={item.hanzi} className="flex items-center gap-2 px-3 py-2">
                <Hanzi text={item.hanzi} singleCharPx={22} boxPx={54} className="text-slate-50" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px]">
                    <Pinyin value={item.pinyin} />
                  </div>
                  <div className="truncate text-[10px] text-slate-500">{item.meaning}</div>
                </div>
                <span className="flex gap-0.5">
                  {item.leech ? <Badge kind="ghost" /> : null}
                  {item.pinned ? <Badge kind="bolt" /> : null}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-slate-500">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ background: GROUP_COLOR[item.group] }}
                  />
                  {item.due}
                </span>
              </li>
            ))}
        {!loading && active.length === 0 ? (
          <li className="px-3 py-8 text-center text-[11px] text-slate-500">
            {empty ? "Nenhum item ainda — adicione seus primeiros caracteres." : "Nada aqui."}
          </li>
        ) : null}
      </ul>

      {shown < active.length ? (
        <button
          type="button"
          onClick={() => setShown((n) => n + 8)}
          className="w-full rounded-lg border border-white/10 py-2 text-[11px] font-medium text-slate-300"
        >
          Carregar mais ({visible.length} de {active.length})
        </button>
      ) : null}
    </div>
  );
}

export function DossierDashboard({ state }: Props) {
  return (
    <>
      <AppChrome>
        <DesktopDashboard state={state} />
      </AppChrome>
      <div className="mx-auto max-w-6xl border-t border-white/10 px-6 py-10">
        <h2 className="mb-6 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Mobile — ações fixas, resumo recolhido, lista em vez de tabela
        </h2>
        <PhoneFrame caption="Barra de ações fixa no topo; métricas num 'Resumo' recolhível; caracteres em lista com 'Carregar mais'.">
          <MobileChrome>
            <MobileDashboard state={state} />
          </MobileChrome>
        </PhoneFrame>
      </div>
    </>
  );
}
