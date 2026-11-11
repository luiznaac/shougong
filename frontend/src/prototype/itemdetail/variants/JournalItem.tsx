// Variant C — "Caderno" (wayfinder #110). One quiet editorial column: numbered
// chapters separated by hairlines. The two data-heavy sections never grow
// downward — trajectory is a horizontal paged strip and related words are a paged
// two-up grid. Mobile collapses chapters into accordions and scrolls the strip.

import { useState } from "react";
import { PhoneFrame } from "../../PhoneFrame.tsx";
import { Icon } from "../../icons.tsx";
import { FACTS, HISTORY, ITEM, RELATED } from "../itemDetailData.ts";
import {
  AppChrome,
  BadgeRow,
  ChartLegend,
  FxChart,
  HskChip,
  ItemGlyph,
  LevelChip,
  LoadMore,
  MobileChrome,
  PriorityBar,
  RelatedRow,
  SnapshotCard,
  StateChip,
  StrokeMock,
} from "../parts.tsx";

const HIST_PER_STRIP = 3;
const REL_PER_PAGE = 6;
const MOBILE_STEP = 4;

function Chapter({
  index,
  title,
  meta,
  children,
}: {
  index: string;
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-white/10 py-6">
      <div className="mb-4 flex items-baseline gap-3">
        <span className="font-mono text-[11px] text-slate-600">{index}</span>
        <h2 className="text-sm font-semibold tracking-wide text-slate-200 uppercase">{title}</h2>
        {meta && <span className="ml-auto text-[11px] tabular-nums text-slate-500">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

function ArrowButton({
  dir,
  disabled,
  onClick,
}: {
  dir: -1 | 1;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === -1 ? "Anterior" : "Próximo"}
      className="rounded-full border border-white/10 p-1.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200 disabled:opacity-25"
    >
      <Icon name={dir === -1 ? "chevron-left" : "chevron-right"} className="h-3.5 w-3.5" />
    </button>
  );
}

function TrajectoryStrip() {
  const pages = Math.ceil(HISTORY.length / HIST_PER_STRIP);
  const [page, setPage] = useState(1);
  const rows = HISTORY.slice((page - 1) * HIST_PER_STRIP, page * HIST_PER_STRIP);

  return (
    <div>
      <ChartLegend />
      <FxChart history={HISTORY} height={150} />
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {rows.map((row) => (
          <SnapshotCard key={row.created_at} row={row} />
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <span className="text-[11px] tabular-nums text-slate-500">
          {(page - 1) * HIST_PER_STRIP + 1}–{Math.min(page * HIST_PER_STRIP, HISTORY.length)} de{" "}
          {HISTORY.length} snapshots
        </span>
        <div className="ml-auto flex items-center gap-1">
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPage(n)}
              aria-label={`Página ${n}`}
              className={`h-1.5 rounded-full transition-all ${
                n === page ? "w-5 bg-accent-500" : "w-1.5 bg-white/15"
              }`}
            />
          ))}
        </div>
        <div className="flex items-center gap-1">
          <ArrowButton dir={-1} disabled={page === 1} onClick={() => setPage(page - 1)} />
          <ArrowButton dir={1} disabled={page === pages} onClick={() => setPage(page + 1)} />
        </div>
      </div>
    </div>
  );
}

function RelatedGrid() {
  const pages = Math.ceil(RELATED.length / REL_PER_PAGE);
  const [page, setPage] = useState(1);
  const rows = RELATED.slice((page - 1) * REL_PER_PAGE, page * REL_PER_PAGE);

  return (
    <div>
      <div className="grid gap-x-6 sm:grid-cols-2">
        {rows.map((entry) => (
          <div key={entry.id} className="border-b border-white/5">
            <RelatedRow entry={entry} />
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <span className="text-[11px] tabular-nums text-slate-500">
          {(page - 1) * REL_PER_PAGE + 1}–{Math.min(page * REL_PER_PAGE, RELATED.length)} de{" "}
          {RELATED.length} palavras
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="text-[11px] tabular-nums text-slate-500">
            {page}/{pages}
          </span>
          <ArrowButton dir={-1} disabled={page === 1} onClick={() => setPage(page - 1)} />
          <ArrowButton dir={1} disabled={page === pages} onClick={() => setPage(page + 1)} />
        </div>
      </div>
    </div>
  );
}

function JournalDesktop() {
  return (
    <AppChrome>
      <main className="mx-auto max-w-4xl px-6 py-8">
        <div className="mb-6 flex items-center gap-2 text-xs text-slate-500">
          <Icon name="book" className="h-3.5 w-3.5" />
          <span>Biblioteca</span>
          <Icon name="chevron-right" className="h-3 w-3" />
          <span>Itens</span>
          <Icon name="chevron-right" className="h-3 w-3" />
          <span className="text-slate-300">{ITEM.entry.simplified}</span>
        </div>

        <header className="flex flex-wrap items-center gap-6 pb-6">
          <div className="flex items-center gap-5">
            <ItemGlyph item={ITEM} singleCharPx={92} boxPx={260} />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold text-white">{ITEM.entry.definitions[0]}</h1>
                <BadgeRow item={ITEM} />
              </div>
              <p className="mt-1 max-w-md text-sm text-slate-400">
                {ITEM.entry.definitions.slice(1).join(" · ")}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <HskChip level={ITEM.entry.hsk_level} />
                <StateChip state={ITEM.card.state} />
                <LevelChip item={ITEM} />
                <span className="text-[11px] text-slate-500">· 2 caracteres, 20 traços</span>
              </div>
            </div>
          </div>
          <div className="ml-auto">
            <PriorityBar compact />
          </div>
        </header>

        <div className="flex flex-wrap gap-x-8 gap-y-2 border-y border-white/10 py-3">
          {FACTS.map(([label, value]) => (
            <div key={label}>
              <div className="text-[10px] tracking-wide text-slate-500 uppercase">{label}</div>
              <div className="text-sm tabular-nums text-slate-200">{value}</div>
            </div>
          ))}
        </div>

        <Chapter index="01" title="Trajetória" meta={`${HISTORY.length} snapshots`}>
          <TrajectoryStrip />
        </Chapter>

        <Chapter index="02" title="Ordem dos traços" meta="2 caracteres">
          <div className="flex flex-wrap items-center gap-8">
            <StrokeMock sizePx={170} />
            <p className="max-w-xs text-sm text-slate-400">
              Um traço por vez, no mesmo quadro com grade 米. Trocar de caractere reinicia a
              contagem, então a leitura fica sempre previsível.
            </p>
          </div>
        </Chapter>

        <Chapter index="03" title="Relacionados" meta={`${RELATED.length} palavras`}>
          <RelatedGrid />
        </Chapter>
      </main>
    </AppChrome>
  );
}

function JournalMobile() {
  const [historyShown, setHistoryShown] = useState(MOBILE_STEP);
  const [relatedShown, setRelatedShown] = useState(MOBILE_STEP);

  return (
    <MobileChrome>
      <div className="space-y-3 p-4">
        <button type="button" className="flex items-center gap-1 text-[11px] text-slate-400">
          <Icon name="chevron-left" className="h-3.5 w-3.5" />
          Biblioteca
        </button>

        <header className="relative pb-2">
          <div className="absolute top-0 right-0">
            <BadgeRow item={ITEM} />
          </div>
          <ItemGlyph item={ITEM} singleCharPx={58} boxPx={200} />
          <div className="mt-1.5 flex flex-wrap items-center justify-center gap-1">
            <HskChip level={ITEM.entry.hsk_level} />
            <StateChip state={ITEM.card.state} />
            <LevelChip item={ITEM} />
          </div>
          <p className="mt-1.5 text-center text-[11px] text-slate-400">
            {ITEM.entry.definitions.join(" · ")}
          </p>
        </header>

        <div className="flex flex-wrap gap-x-5 gap-y-1.5 border-y border-white/10 py-2.5">
          {FACTS.slice(0, 4).map(([label, value]) => (
            <div key={label}>
              <div className="text-[9px] tracking-wide text-slate-500 uppercase">{label}</div>
              <div className="text-[11px] tabular-nums text-slate-200">{value}</div>
            </div>
          ))}
        </div>

        <PriorityBar compact />

        <details open className="group rounded-xl bg-slate-900/40 ring-1 ring-white/10">
          <summary className="flex cursor-pointer items-center px-3 py-2.5 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            Trajetória
            <span className="ml-auto text-[10px] font-normal normal-case text-slate-600">
              {HISTORY.length} snapshots
            </span>
          </summary>
          <div className="px-3 pb-3">
            <FxChart history={HISTORY} height={120} />
            <div className="-mx-1 mt-2 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
              {HISTORY.slice(0, historyShown).map((row) => (
                <div key={row.created_at} className="w-40 shrink-0 snap-start">
                  <SnapshotCard row={row} />
                </div>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-slate-600">
              Arraste a trilha para o lado — ela não empurra a página para baixo.
            </p>
            <LoadMore
              shown={historyShown}
              total={HISTORY.length}
              onMore={() => setHistoryShown(historyShown + MOBILE_STEP)}
            />
          </div>
        </details>

        <details className="group rounded-xl bg-slate-900/40 ring-1 ring-white/10">
          <summary className="flex cursor-pointer items-center px-3 py-2.5 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            Ordem dos traços
            <span className="ml-auto text-[10px] font-normal normal-case text-slate-600">
              2 caracteres
            </span>
          </summary>
          <div className="px-3 pb-4">
            <StrokeMock sizePx={140} />
          </div>
        </details>

        <details open className="group rounded-xl bg-slate-900/40 ring-1 ring-white/10">
          <summary className="flex cursor-pointer items-center px-3 py-2.5 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            Relacionados
            <span className="ml-auto text-[10px] font-normal normal-case text-slate-600">
              {RELATED.length} palavras
            </span>
          </summary>
          <div className="px-3 pb-3">
            <ul className="divide-y divide-white/5">
              {RELATED.slice(0, relatedShown).map((entry) => (
                <li key={entry.id}>
                  <RelatedRow entry={entry} />
                </li>
              ))}
            </ul>
            <LoadMore
              shown={relatedShown}
              total={RELATED.length}
              onMore={() => setRelatedShown(relatedShown + MOBILE_STEP)}
            />
          </div>
        </details>
      </div>
    </MobileChrome>
  );
}

export function JournalItem() {
  return (
    <>
      <JournalDesktop />
      <div className="mx-auto max-w-4xl px-6 pb-16">
        <div className="mt-10 flex items-center gap-3">
          <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
            Mobile · 390px
          </span>
          <span className="h-px flex-1 bg-white/10" />
        </div>
        <div className="mt-4 flex justify-center">
          <PhoneFrame caption="Caderno no celular: capítulos em acordeão, trajetória em trilha horizontal (snap) e relacionados com 'Carregar mais'.">
            <JournalMobile />
          </PhoneFrame>
        </div>
      </div>
    </>
  );
}
