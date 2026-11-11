// PROTOTYPE (wayfinder ticket #105) — Variant C "Paper + palette".
// Desktop: compact icon rail, an always-on command palette, and a list-first
// today dossier. Mobile: bottom tabs + paper sheet. Light warm palette, serif
// headings, square-ish ink borders — the boldest visual-refresh direction.

import { Hanzi } from "../../components/Hanzi.tsx";
import { Pinyin } from "../../components/Pinyin.tsx";
import { GROUP_COLOR } from "../../lib/srs.ts";
import { PhoneFrame } from "../PhoneFrame.tsx";
import { Icon } from "../icons.tsx";
import { COUNTS, DUE_WEEK, MOCK_ITEMS, SRS_COUNTS, SRS_LABEL } from "../prototypeData.ts";

const INK = "#292524";
const PAPER = "#f6f2ea";
const ACCENT = "#c2410c";

const RAIL = [
  ["home", "Hoje", true],
  ["grid", "Itens", false],
  ["text", "Leitura", false],
  ["chart", "Progresso", false],
  ["plus", "Adicionar", false],
] as const;

function QueueRow({ item, last }: { item: (typeof MOCK_ITEMS)[number]; last: boolean }) {
  return (
    <div
      className={`grid grid-cols-[44px_1fr_auto] items-center gap-3 px-3 py-2.5 ${last ? "" : "border-b"}`}
      style={{ borderColor: `${INK}14` }}
    >
      <Hanzi text={item.hanzi} singleCharPx={26} boxPx={40} className="text-[#292524]" />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{item.meaning}</span>
          {item.leech ? (
            <span className="rounded-full bg-[#c2410c]/10 px-1.5 text-[10px] text-[#c2410c]">
              sanguessuga
            </span>
          ) : null}
        </div>
        <Pinyin value={item.pinyin} className="text-xs text-[#78716c]" />
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden items-center gap-1 text-[11px] text-[#78716c] sm:flex">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: GROUP_COLOR[item.group] }}
          />
          {SRS_LABEL[item.group]}
        </span>
        <span className="text-[11px] text-[#78716c]">{item.due}</span>
        <Icon name="chevron-right" className="h-4 w-4 text-[#a8a29e]" />
      </div>
    </div>
  );
}

function MobileShell() {
  return (
    <div className="flex h-full flex-col" style={{ backgroundColor: PAPER, color: INK }}>
      <header
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: `${INK}14` }}
      >
        <div className="flex items-center gap-2">
          <span lang="zh-Hans" className="font-hanzi text-lg" style={{ color: ACCENT }}>
            手工
          </span>
          <span className="text-[11px] font-semibold tracking-wide text-[#78716c]">shougong</span>
        </div>
        <Icon name="search" className="h-5 w-5 text-[#78716c]" />
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-[#a8a29e]">Terça, 10 nov</p>
          <h1 className="font-serif text-2xl">Hoje</h1>
        </div>

        <div
          className="rounded-sm border p-4"
          style={{ borderColor: `${INK}1f`, backgroundColor: "#fffdf8" }}
        >
          <div className="flex items-end gap-4">
            <div>
              <div className="font-serif text-4xl tabular-nums" style={{ color: ACCENT }}>
                {COUNTS.reviews}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-[#78716c]">reviews</div>
            </div>
            <div>
              <div className="font-serif text-2xl tabular-nums">{COUNTS.lessons}</div>
              <div className="text-[10px] uppercase tracking-wide text-[#78716c]">lições</div>
            </div>
          </div>
          <button
            type="button"
            className="mt-3 w-full rounded-sm py-2.5 text-sm font-medium text-[#f6f2ea]"
            style={{ backgroundColor: INK }}
          >
            Começar · {COUNTS.dueToday}
          </button>
        </div>

        <div className="rounded-sm border bg-[#fffdf8]" style={{ borderColor: `${INK}1f` }}>
          {MOCK_ITEMS.slice(0, 4).map((it, i) => (
            <QueueRow key={it.hanzi} item={it} last={i === 3} />
          ))}
        </div>
      </div>

      <div
        className="mx-2 mb-1 rounded-t-lg border bg-[#fffdf8] p-2"
        style={{ borderColor: `${INK}1f` }}
      >
        <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-[#a8a29e]">
          Mais
        </div>
        {[
          ["Progresso", "chart"],
          ["Adicionar", "plus"],
          ["Importar CSV", "upload"],
          ["Ajustes", "sliders"],
        ].map(([label, icon]) => (
          <div key={label} className="flex items-center gap-2 px-2 py-1.5 text-xs text-[#57534e]">
            <Icon name={icon} className="h-4 w-4 text-[#a8a29e]" /> {label}
          </div>
        ))}
      </div>

      <nav className="flex px-2 pb-2 pt-1" style={{ backgroundColor: INK }}>
        {[
          ["Hoje", "home", true],
          ["Itens", "grid", false],
          ["Leitura", "text", false],
          ["Mais", "more", false],
        ].map(([label, icon, active]) => (
          <div
            key={String(label)}
            className="flex flex-1 flex-col items-center gap-0.5 pt-1"
            style={{ color: active ? "#fb923c" : "#a8a29e" }}
          >
            <Icon name={String(icon)} className="h-5 w-5" />
            <span className="text-[9px]">{label}</span>
          </div>
        ))}
      </nav>
    </div>
  );
}

export function PaperPaletteShell() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: PAPER, color: INK }}>
      <div className="mx-auto grid min-h-screen max-w-[1400px] md:grid-cols-[84px_1fr]">
        <aside
          className="flex flex-col items-center gap-1 border-r py-5"
          style={{ borderColor: `${INK}14` }}
        >
          <span lang="zh-Hans" className="mb-3 font-hanzi text-xl" style={{ color: ACCENT }}>
            手工
          </span>
          {RAIL.map(([icon, label, active]) => (
            <div
              key={label}
              className="flex w-full flex-col items-center gap-0.5 py-2 text-[9px]"
              style={
                active
                  ? {
                      backgroundColor: `${ACCENT}12`,
                      color: ACCENT,
                      borderLeft: `2px solid ${ACCENT}`,
                    }
                  : { color: "#78716c" }
              }
            >
              <Icon name={icon} className="h-5 w-5" />
              {label}
            </div>
          ))}
          <div className="mt-auto flex flex-col items-center gap-0.5 py-2 text-[9px] text-[#78716c]">
            <Icon name="user" className="h-5 w-5" />
            Conta
          </div>
        </aside>

        <main className="px-6 py-6 lg:px-10">
          <div className="mb-6 flex items-center gap-4">
            <div
              className="flex flex-1 items-center gap-2 rounded-sm border bg-[#fffdf8] px-3 py-2.5 text-sm text-[#a8a29e]"
              style={{ borderColor: `${INK}1f` }}
            >
              <Icon name="search" className="h-4 w-4" />
              Buscar itens, lições, leituras…
              <span
                className="ml-auto rounded border px-1.5 py-0.5 text-[10px]"
                style={{ borderColor: `${INK}1f` }}
              >
                ⌘K
              </span>
            </div>
            <span
              className="grid h-9 w-9 place-items-center rounded-full text-xs text-[#f6f2ea]"
              style={{ backgroundColor: INK }}
            >
              LN
            </span>
          </div>

          <div className="mb-5 flex items-end justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-[#a8a29e]">
                Terça, 10 de novembro
              </p>
              <h1 className="font-serif text-3xl">Hoje</h1>
            </div>
            <span className="text-xs text-[#78716c]">🔥 {COUNTS.streak} dias seguidos</span>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
            <div className="space-y-5">
              <section
                className="rounded-sm border p-6"
                style={{ borderColor: `${INK}1f`, backgroundColor: "#fffdf8" }}
              >
                <div className="flex flex-wrap items-end gap-8">
                  <div>
                    <div
                      className="font-serif text-6xl leading-none tabular-nums"
                      style={{ color: ACCENT }}
                    >
                      {COUNTS.reviews}
                    </div>
                    <div className="mt-1 text-[10px] uppercase tracking-wide text-[#78716c]">
                      reviews vencendo
                    </div>
                  </div>
                  <div>
                    <div className="font-serif text-4xl leading-none tabular-nums">
                      {COUNTS.lessons}
                    </div>
                    <div className="mt-1 text-[10px] uppercase tracking-wide text-[#78716c]">
                      lições novas
                    </div>
                  </div>
                  <button
                    type="button"
                    className="ml-auto flex items-center gap-2 rounded-sm px-6 py-3 text-sm font-medium text-[#f6f2ea]"
                    style={{ backgroundColor: INK }}
                  >
                    Começar sessão <Icon name="arrow-right" className="h-4 w-4" />
                  </button>
                </div>
              </section>

              <section
                className="rounded-sm border bg-[#fffdf8]"
                style={{ borderColor: `${INK}1f` }}
              >
                <div
                  className="flex items-center justify-between border-b px-4 py-3"
                  style={{ borderColor: `${INK}14` }}
                >
                  <h2 className="font-serif text-lg">Fila de hoje</h2>
                  <span className="text-[11px] text-[#78716c]">{MOCK_ITEMS.length} itens</span>
                </div>
                {MOCK_ITEMS.map((item, i) => (
                  <QueueRow key={item.hanzi} item={item} last={i === MOCK_ITEMS.length - 1} />
                ))}
              </section>
            </div>

            <div className="space-y-5">
              <section
                className="rounded-sm border p-4"
                style={{ borderColor: `${INK}1f`, backgroundColor: "#fffdf8" }}
              >
                <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-[#a8a29e]">
                  Próximos 7 dias
                </h2>
                <div className="flex h-28 items-end gap-1.5">
                  {DUE_WEEK.map((d) => (
                    <div
                      key={d.day}
                      className="flex flex-1 flex-col items-center justify-end gap-1"
                    >
                      <div
                        className="w-full rounded-t-sm"
                        style={{
                          height: `${(d.count / 11) * 80}px`,
                          backgroundColor: `${ACCENT}99`,
                        }}
                      />
                      <span className="text-[9px] text-[#a8a29e]">{d.day}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section
                className="rounded-sm border p-4"
                style={{ borderColor: `${INK}1f`, backgroundColor: "#fffdf8" }}
              >
                <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-[#a8a29e]">
                  Escada SRS
                </h2>
                <div className="space-y-2">
                  {(Object.keys(SRS_COUNTS) as (keyof typeof SRS_COUNTS)[]).map((g) => (
                    <div key={g} className="flex items-center gap-2 text-xs">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: GROUP_COLOR[g] }}
                      />
                      <span className="flex-1 text-[#57534e]">{SRS_LABEL[g]}</span>
                      <span className="tabular-nums text-[#78716c]">{SRS_COUNTS[g]}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section
                className="rounded-sm border p-4"
                style={{ borderColor: `${INK}1f`, backgroundColor: `${ACCENT}0d` }}
              >
                <h2 className="font-serif text-lg" style={{ color: ACCENT }}>
                  Leitura do dia
                </h2>
                <p className="mt-1 text-xs text-[#57534e]">
                  Um diálogo curto sobre rotinas, com 2 palavras novas.
                </p>
                <button
                  type="button"
                  className="mt-3 text-xs font-medium"
                  style={{ color: ACCENT }}
                >
                  Gerar leitura →
                </button>
              </section>
            </div>
          </div>
        </main>
      </div>

      <div
        className="mx-auto max-w-[1400px] border-t px-6 py-10 lg:px-10"
        style={{ borderColor: `${INK}14` }}
      >
        <h2 className="mb-6 text-sm font-semibold uppercase tracking-wide text-[#78716c]">
          Mobile — abas + folha em papel
        </h2>
        <PhoneFrame caption="Abas Hoje/Itens/Leitura/Mais em tinta; a folha 'Mais' em papel cobre a base do conteúdo.">
          <MobileShell />
        </PhoneFrame>
      </div>
    </div>
  );
}
