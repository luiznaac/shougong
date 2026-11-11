// PROTOTYPE (wayfinder ticket #105) — Variant B "Rail + hero".
// Desktop: fixed left rail with grouped IA sections (Estudar / Biblioteca /
// Descobrir) and a wide hero with a due ring. Mobile: bottom tabs + grouped
// overflow sheet. Ink background, violet accent, roomier spacing.

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

const GROUPS = [
  {
    title: "Estudar",
    items: [
      ["Hoje", "home", true],
      ["Lições", "spark", false],
      ["Reviews", "layers", false],
    ],
  },
  {
    title: "Biblioteca",
    items: [
      ["Itens", "grid", false],
      ["Adicionar", "plus", false],
      ["Importar", "upload", false],
    ],
  },
  {
    title: "Descobrir",
    items: [
      ["Leitura", "text", false],
      ["Progresso", "chart", false],
    ],
  },
] as const;

function Ring({ value, max }: { value: number; max: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const pct = Math.min(1, value / max);
  return (
    <div className="relative grid h-36 w-36 place-items-center">
      <svg viewBox="0 0 128 128" className="h-36 w-36 -rotate-90">
        <title>Progresso de reviews de hoje</title>
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="10"
        />
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          stroke="#8b5cf6"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-3xl font-semibold tabular-nums text-white">{value}</div>
        <div className="text-[10px] uppercase tracking-wide text-slate-500">devidos</div>
      </div>
    </div>
  );
}

function Tile({ item }: { item: MockItem }) {
  return (
    <div
      className="flex w-24 flex-col items-center rounded-xl bg-white/[0.03] px-1.5 py-2 text-center ring-1 ring-white/[0.06] hover:bg-white/[0.06]"
      style={{ boxShadow: `inset 0 -3px 0 ${GROUP_COLOR[item.group]}` }}
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

function Sidebar() {
  return (
    <aside className="flex h-full flex-col gap-6 border-r border-white/[0.07] px-4 py-5">
      <div className="flex items-center gap-2 px-2">
        <span lang="zh-Hans" className="font-hanzi text-xl text-violet-400">
          手工
        </span>
        <span className="text-sm font-semibold tracking-wide text-slate-200">shougong</span>
      </div>

      <div className="flex-1 space-y-5">
        {GROUPS.map((group) => (
          <div key={group.title}>
            <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
              {group.title}
            </div>
            <div className="space-y-0.5">
              {group.items.map(([label, icon, active]) => (
                <div
                  key={label}
                  className={`relative flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm ${
                    active ? "bg-violet-500/10 text-violet-200" : "text-slate-400"
                  }`}
                >
                  {active ? (
                    <span className="absolute left-0 h-5 w-0.5 rounded-full bg-violet-400" />
                  ) : null}
                  <Icon name={icon} className="h-4 w-4" />
                  {label}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-violet-500/10 p-3 ring-1 ring-violet-500/20">
        <div className="flex items-center gap-2 text-xs font-medium text-violet-200">
          <Icon name="clock" className="h-4 w-4" /> {COUNTS.dueToday} devidos hoje
        </div>
        <button
          type="button"
          className="mt-2 w-full rounded-lg bg-violet-500 py-1.5 text-xs font-semibold text-white"
        >
          Começar review
        </button>
      </div>

      <div className="flex items-center gap-2 border-t border-white/[0.07] pt-3">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-xs text-slate-300">
          LN
        </span>
        <span className="text-xs text-slate-400">luiznaac</span>
        <Icon name="sliders" className="ml-auto h-4 w-4 text-slate-500" />
      </div>
    </aside>
  );
}

function MobileShell() {
  return (
    <div className="flex h-full flex-col bg-[#0b1020] text-slate-200">
      <header className="flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <span lang="zh-Hans" className="font-hanzi text-lg text-violet-400">
            手工
          </span>
          <span className="text-xs font-semibold tracking-wide text-slate-300">shougong</span>
        </div>
        <Icon name="user" className="h-5 w-5 text-slate-500" />
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Ter, 10 nov</p>
          <div className="mt-2 flex items-center gap-4">
            <div className="grid h-20 w-20 place-items-center rounded-full border-4 border-violet-500/70">
              <span className="text-xl font-semibold tabular-nums text-white">
                {COUNTS.dueToday}
              </span>
            </div>
            <div className="space-y-1 text-xs text-slate-400">
              <div>{COUNTS.reviews} reviews</div>
              <div>{COUNTS.lessons} lições novas</div>
              <div className="text-violet-300">🔥 {COUNTS.streak} dias</div>
            </div>
          </div>
          <button
            type="button"
            className="mt-4 w-full rounded-xl bg-violet-500 py-3 text-sm font-semibold text-white"
          >
            Começar review
          </button>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {MOCK_ITEMS.slice(0, 8).map((it) => (
            <div
              key={it.hanzi}
              className="rounded-lg bg-white/[0.03] py-1 text-center ring-1 ring-white/[0.06]"
              style={{ boxShadow: `inset 0 -2px 0 ${GROUP_COLOR[it.group]}` }}
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
      </div>

      <div className="mx-3 mb-2 rounded-2xl bg-[#131a2f] p-2 shadow-xl ring-1 ring-white/10">
        <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Mais
        </div>
        <div className="grid grid-cols-2 gap-1">
          {[
            ["Biblioteca", "grid"],
            ["Itens", "book"],
            ["Progresso", "chart"],
            ["Adicionar", "plus"],
            ["Importar", "upload"],
            ["Ajustes", "sliders"],
          ].map(([label, icon]) => (
            <div
              key={label}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] text-slate-300"
            >
              <Icon name={icon} className="h-4 w-4 text-slate-500" /> {label}
            </div>
          ))}
        </div>
      </div>

      <nav className="flex border-t border-white/[0.07] px-2 pb-2 pt-1">
        {[
          ["Hoje", "home", true],
          ["Lições", "spark", false],
          ["Leitura", "text", false],
          ["Mais", "more", false],
        ].map(([label, icon, active]) => (
          <div
            key={String(label)}
            className={`flex flex-1 flex-col items-center gap-0.5 pt-1 ${active ? "text-violet-300" : "text-slate-500"}`}
          >
            <Icon name={String(icon)} className="h-5 w-5" />
            <span className="text-[9px]">{label}</span>
          </div>
        ))}
      </nav>
    </div>
  );
}

export function RailHeroShell() {
  return (
    <div className="min-h-screen bg-[#0b1020] text-slate-200">
      <div className="mx-auto grid min-h-screen max-w-[1400px] md:grid-cols-[248px_1fr]">
        <Sidebar />

        <main className="space-y-5 px-6 py-6 lg:px-10">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wide text-slate-600">
              Hoje · terça, 10 de novembro
            </p>
            <span className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-1.5 text-xs text-slate-500 ring-1 ring-white/[0.06]">
              <Icon name="search" className="h-4 w-4" /> Buscar itens{" "}
              <kbd className="rounded bg-white/10 px-1.5 text-[10px]">⌘K</kbd>
            </span>
          </div>

          <section className="grid gap-4 lg:grid-cols-[1fr_auto]">
            <div className="rounded-2xl bg-gradient-to-br from-violet-600/20 to-transparent p-7 ring-1 ring-violet-500/20">
              <h1 className="text-2xl font-semibold text-white">Seu dia começa aqui.</h1>
              <p className="mt-1 max-w-md text-sm text-slate-400">
                {COUNTS.reviews} reviews vencendo e {COUNTS.lessons} lições novas esperando. Um
                passo de cada vez.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-xl bg-violet-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/20"
                >
                  Começar reviews · {COUNTS.reviews} <Icon name="arrow-right" className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-white/[0.06] px-5 py-3 text-sm font-semibold text-slate-100 ring-1 ring-white/10"
                >
                  Lições · {COUNTS.lessons}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-center rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/[0.06]">
              <Ring value={COUNTS.dueToday} max={30} />
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06] lg:col-span-2">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Escada SRS
              </h2>
              <div className="flex h-3 overflow-hidden rounded-full">
                {(Object.keys(SRS_COUNTS) as (keyof typeof SRS_COUNTS)[]).map((g) => (
                  <div
                    key={g}
                    style={{
                      width: `${(SRS_COUNTS[g] / 30) * 100}%`,
                      backgroundColor: GROUP_COLOR[g],
                    }}
                    title={SRS_LABEL[g]}
                  />
                ))}
              </div>
              <div className="mt-3 grid grid-cols-5 gap-2">
                {(Object.keys(SRS_COUNTS) as (keyof typeof SRS_COUNTS)[]).map((g) => (
                  <div key={g}>
                    <div className="text-lg font-semibold tabular-nums text-white">
                      {SRS_COUNTS[g]}
                    </div>
                    <div className="text-[10px] text-slate-500">{SRS_LABEL[g]}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/[0.06]">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Próximos 7 dias
              </h2>
              <div className="flex h-24 items-end gap-1.5">
                {DUE_WEEK.map((d) => (
                  <div key={d.day} className="flex flex-1 flex-col items-center justify-end gap-1">
                    <div
                      className="w-full rounded-t bg-violet-500/60"
                      style={{ height: `${(d.count / 11) * 72}px` }}
                    />
                    <span className="text-[9px] text-slate-500">{d.day}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-white/[0.03] p-5 ring-1 ring-white/[0.06]">
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
      </div>

      <div className="mx-auto max-w-[1400px] border-t border-white/[0.07] px-6 py-10 lg:px-10">
        <h2 className="mb-6 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Mobile — bottom tabs + grouped sheet
        </h2>
        <PhoneFrame caption="Abas Hoje/Lições/Leitura/Mais; 'Mais' abre uma folha com as seções Biblioteca, Progresso e Adicionar.">
          <MobileShell />
        </PhoneFrame>
      </div>
    </div>
  );
}
