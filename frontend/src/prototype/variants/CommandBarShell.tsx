// PROTOTYPE (wayfinder ticket #105) — Variant A "Command bar".
// Desktop: persistent top bar, centred content, one calm daily-loop surface.
// Mobile: top app bar + bottom tab bar (Hoje / Biblioteca / Leitura / Mais) with
// a "Mais" overflow sheet. Dark slate, cerise accent — an evolution of today's look.

import { Hanzi } from "../../components/Hanzi.tsx";
import { Pinyin } from "../../components/Pinyin.tsx";
import { GROUP_COLOR } from "../../lib/srs.ts";
import { PhoneFrame } from "../PhoneFrame.tsx";
import { Icon } from "../icons.tsx";
import {
  COUNTS,
  DUE_WEEK,
  MOCK_ITEMS,
  type MockItem,
  SRS_COUNTS,
  SRS_LABEL,
} from "../prototypeData.ts";

const NAV = ["Hoje", "Biblioteca", "Leitura", "Progresso"];

function Tile({ item }: { item: MockItem }) {
  return (
    <div
      className="flex w-24 flex-col items-center rounded-lg border-b-2 bg-slate-900/70 px-1.5 py-2 text-center ring-1 ring-white/5"
      style={{ borderColor: GROUP_COLOR[item.group] }}
      title={`${SRS_LABEL[item.group]} · ${item.due}`}
    >
      <div className="flex h-4 items-center gap-1 self-end">
        {item.leech ? <span className="text-[10px]">👻</span> : null}
        {item.pinned ? <span className="text-[10px]">📌</span> : null}
      </div>
      <Pinyin value={item.pinyin} className="max-w-full truncate text-[10px] leading-tight" />
      <Hanzi text={item.hanzi} singleCharPx={28} boxPx={88} className="my-1 text-slate-50" />
      <span className="line-clamp-1 max-w-full text-[10px] text-slate-400">{item.meaning}</span>
    </div>
  );
}

function StatLadder() {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {Object.entries(SRS_COUNTS).map(([group, count]) => (
        <div
          key={group}
          className="rounded-md bg-slate-900/70 px-1 py-2 text-center ring-1 ring-white/5"
        >
          <div
            className="text-lg font-semibold tabular-nums"
            style={{ color: GROUP_COLOR[group as keyof typeof GROUP_COLOR] }}
          >
            {count}
          </div>
          <div className="truncate text-[9px] text-slate-500">
            {SRS_LABEL[group as keyof typeof SRS_LABEL]}
          </div>
        </div>
      ))}
    </div>
  );
}

function MobileShell() {
  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-200">
      <header className="flex h-14 items-center justify-between border-b border-white/10 px-4">
        <div className="flex items-center gap-2">
          <span lang="zh-Hans" className="font-hanzi text-lg text-accent-500">
            手工
          </span>
          <span className="text-xs font-semibold tracking-wide text-slate-400">shougong</span>
        </div>
        <Icon name="search" className="h-5 w-5 text-slate-400" />
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        <p className="text-xs text-slate-500">Ter, 10 nov</p>
        <div>
          <h1 className="text-xl font-semibold">Bom dia</h1>
          <p className="text-xs text-slate-400">
            {COUNTS.dueToday} vencendo hoje · {COUNTS.lessons} lições
          </p>
        </div>

        <div className="space-y-2">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-xl bg-gradient-to-r from-rose-500 to-accent-600 px-4 py-4 text-left"
          >
            <span>
              <span className="block text-2xl font-semibold tabular-nums">{COUNTS.reviews}</span>
              <span className="text-xs">Reviews</span>
            </span>
            <Icon name="arrow-right" className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-4 py-3 text-left"
          >
            <span>
              <span className="block text-xl font-semibold tabular-nums">{COUNTS.lessons}</span>
              <span className="text-xs">Lições</span>
            </span>
            <Icon name="arrow-right" className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {MOCK_ITEMS.slice(0, 8).map((it) => (
            <div
              key={it.hanzi}
              className="rounded-lg border-b-2 bg-slate-900/70 py-1 text-center"
              style={{ borderColor: GROUP_COLOR[it.group] }}
            >
              <Pinyin value={it.pinyin} className="block truncate px-0.5 text-[8px]" />
              <Hanzi
                text={it.hanzi}
                singleCharPx={20}
                boxPx={62}
                className="my-0.5 text-slate-50"
              />
            </div>
          ))}
        </div>

        <div className="h-16 rounded-xl border border-dashed border-white/10 p-3 text-[10px] text-slate-600">
          conteúdo da fila…
        </div>
      </div>

      {/* overflow sheet — sits above the tab bar so both models read at once */}
      <div className="mx-3 mb-2 rounded-2xl border border-white/10 bg-slate-900 p-2 shadow-xl">
        <div className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Mais
        </div>
        {[
          ["Progresso", "chart"],
          ["Adicionar", "plus"],
          ["Importar CSV", "upload"],
          ["Ajustes", "sliders"],
        ].map(([label, icon]) => (
          <div
            key={label}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-300"
          >
            <Icon name={icon} className="h-4 w-4 text-slate-500" />
            {label}
          </div>
        ))}
      </div>

      <nav className="flex border-t border-white/10 bg-slate-950 px-2 pb-2 pt-1">
        {[
          ["Hoje", "home", true],
          ["Biblioteca", "book", false],
          ["Leitura", "text", false],
          ["Mais", "more", false],
        ].map(([label, icon, active]) => (
          <div
            key={String(label)}
            className={`flex flex-1 flex-col items-center gap-0.5 pt-1 ${active ? "text-accent-500" : "text-slate-500"}`}
          >
            <Icon name={String(icon)} className="h-5 w-5" />
            <span className="text-[9px]">{label}</span>
          </div>
        ))}
      </nav>
    </div>
  );
}

export function CommandBarShell() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-7 px-6">
          <div className="flex items-center gap-2">
            <span lang="zh-Hans" className="font-hanzi text-xl text-accent-500">
              手工
            </span>
            <span className="text-sm font-semibold tracking-wide text-slate-300">shougong</span>
          </div>
          <nav className="flex items-center gap-1">
            {NAV.map((label, i) => (
              <span
                key={label}
                className={`cursor-default rounded-md px-3 py-1.5 text-sm font-medium ${
                  i === 0 ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {label}
              </span>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400">
              <Icon name="search" className="h-4 w-4" />
              Buscar
              <kbd className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-400">⌘K</kbd>
            </span>
            <span className="flex items-center gap-2 rounded-lg bg-accent-500/15 px-3 py-1.5 text-xs font-medium text-accent-300 ring-1 ring-accent-500/30">
              <Icon name="clock" className="h-4 w-4" />
              Retomar · {COUNTS.dueToday}
            </span>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-800 text-xs text-slate-300">
              LN
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Terça, 10 de novembro</p>
            <h1 className="mt-1 text-2xl font-semibold text-white">Bom dia. Vamos estudar.</h1>
          </div>
          <span className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs text-slate-400">
            🔥 {COUNTS.streak} dias seguidos
          </span>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
          <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/40 p-6 ring-1 ring-white/10">
            <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-accent-500/10 blur-3xl" />
            <p className="text-sm text-slate-400">Sua fila de hoje</p>
            <div className="mt-2 flex items-baseline gap-6">
              <span className="text-5xl font-semibold tabular-nums text-white">
                {COUNTS.reviews}
              </span>
              <span className="text-sm text-slate-400">reviews</span>
              <span className="text-3xl font-semibold tabular-nums text-slate-300">
                {COUNTS.lessons}
              </span>
              <span className="text-sm text-slate-400">lições novas</span>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-rose-500 to-accent-600 px-5 py-3 text-sm font-semibold text-white shadow-lg"
              >
                Começar reviews <Icon name="arrow-right" className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="flex items-center gap-2 rounded-xl bg-slate-800 px-5 py-3 text-sm font-semibold text-slate-100 ring-1 ring-white/10"
              >
                Aprender {COUNTS.lessons} novas
              </button>
            </div>
          </section>

          <section className="rounded-2xl bg-slate-900/50 p-5 ring-1 ring-white/10">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Escada SRS
              </h2>
              <Icon name="layers" className="h-4 w-4 text-slate-600" />
            </div>
            <StatLadder />
            <div className="mt-4 space-y-1.5">
              {DUE_WEEK.slice(0, 4).map((d) => (
                <div key={d.day} className="flex items-center gap-2 text-[11px]">
                  <span className="w-8 text-slate-500">{d.day}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-accent-500/70"
                      style={{ width: `${(d.count / 11) * 100}%` }}
                    />
                  </div>
                  <span className="w-4 text-right tabular-nums text-slate-400">{d.count}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section className="rounded-2xl bg-slate-900/50 p-5 ring-1 ring-white/10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Fila de hoje
            </h2>
            <span className="text-xs text-slate-500">Todas ({MOCK_ITEMS.length})</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {MOCK_ITEMS.map((item) => (
              <Tile key={item.hanzi} item={item} />
            ))}
          </div>
        </section>
      </main>

      <div className="mx-auto max-w-6xl border-t border-white/10 px-6 py-10">
        <h2 className="mb-6 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Mobile — bottom tabs + overflow sheet
        </h2>
        <PhoneFrame caption="Top app bar, bottom tab bar (Hoje/Biblioteca/Leitura/Mais) e a folha 'Mais' acima das abas.">
          <MobileShell />
        </PhoneFrame>
      </div>
    </div>
  );
}
