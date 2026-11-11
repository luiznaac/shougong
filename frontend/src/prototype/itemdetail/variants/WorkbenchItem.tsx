// Variant E — "Bancada" (wayfinder #110). A blend: B's full-width identity
// header, C's facts line and horizontal trajectory strip, A's bounded related
// list — plus a new master-detail pane for the generated readings that contain
// the word. Picking a reading shows its snippet in place, so the item page also
// answers "where have I seen this word?".

import { useState } from "react";
import { PhoneFrame } from "../../PhoneFrame.tsx";
import { Icon } from "../../icons.tsx";
import { FACTS, HISTORY, ITEM, READINGS, RELATED } from "../itemDetailData.ts";
import {
  AppChrome,
  ArrowButton,
  BadgeRow,
  ChartLegend,
  FxChart,
  HskChip,
  ItemGlyph,
  LevelChip,
  LoadMore,
  MobileChrome,
  Pager,
  PriorityBar,
  ReadingDetail,
  ReadingRow,
  RelatedRow,
  SnapshotCard,
  StateChip,
  StrokeMock,
} from "../parts.tsx";

const STRIP_PER_PAGE = 3;
const REL_PER_PAGE = 6;
const MOBILE_STEP = 4;

function IdentityHeaderWide() {
  return (
    <section className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/30 p-6 ring-1 ring-white/10">
      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-5">
          <ItemGlyph item={ITEM} singleCharPx={78} boxPx={230} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-100">{ITEM.entry.definitions[0]}</h1>
              <BadgeRow item={ITEM} />
            </div>
            <p className="mt-0.5 text-sm text-slate-400">
              {ITEM.entry.definitions.slice(1).join(" · ")}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <HskChip level={ITEM.entry.hsk_level} />
              <StateChip state={ITEM.card.state} />
              <LevelChip item={ITEM} />
              <span className="text-[11px] text-slate-500">· 2 caracteres</span>
            </div>
          </div>
        </div>
        <div className="ml-auto">
          <PriorityBar compact />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 border-t border-white/10 pt-3">
        {FACTS.map(([label, value]) => (
          <div key={label}>
            <div className="text-[10px] tracking-wide text-slate-500 uppercase">{label}</div>
            <div className="text-sm tabular-nums text-slate-200">{value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function TrajectoryStripBanded() {
  const pages = Math.ceil(HISTORY.length / STRIP_PER_PAGE);
  const [page, setPage] = useState(1);
  const rows = HISTORY.slice((page - 1) * STRIP_PER_PAGE, page * STRIP_PER_PAGE);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <ChartLegend />
        <span className="text-[11px] tabular-nums text-slate-500">{HISTORY.length} snapshots</span>
      </div>
      <FxChart history={HISTORY} height={150} />
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {rows.map((row) => (
          <SnapshotCard key={row.created_at} row={row} />
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <span className="text-[11px] tabular-nums text-slate-500">
          {(page - 1) * STRIP_PER_PAGE + 1}–{Math.min(page * STRIP_PER_PAGE, HISTORY.length)} de{" "}
          {HISTORY.length}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`Página ${n}`}
              onClick={() => setPage(n)}
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

function ReadingsWorkbench({ compact = false }: { compact?: boolean }) {
  const [selectedId, setSelectedId] = useState(READINGS[0].id);
  const selected = READINGS.find((r) => r.id === selectedId) ?? READINGS[0];

  return (
    <div className="flex flex-col gap-3">
      <div>
        <div className="mb-1.5 flex items-baseline justify-between">
          <h2 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
            Leituras com{" "}
            <span lang="zh-Hans" className="font-hanzi text-slate-200">
              {ITEM.entry.simplified}
            </span>
          </h2>
          <span className="text-[11px] tabular-nums text-slate-500">{READINGS.length}</span>
        </div>
        <div
          className={`space-y-0.5 overflow-y-auto pr-1 ${compact ? "max-h-56" : "max-h-[19rem]"}`}
        >
          {READINGS.map((reading) => (
            <ReadingRow
              key={reading.id}
              reading={reading}
              selected={reading.id === selectedId}
              onSelect={() => setSelectedId(reading.id)}
            />
          ))}
        </div>
      </div>
      <ReadingDetail reading={selected} />
    </div>
  );
}

function WorkbenchDesktop() {
  const [relatedPage, setRelatedPage] = useState(1);
  const relatedRows = RELATED.slice((relatedPage - 1) * REL_PER_PAGE, relatedPage * REL_PER_PAGE);

  return (
    <AppChrome>
      <main className="mx-auto max-w-6xl px-6 py-7">
        <div className="mb-4 flex items-center gap-2 text-xs text-slate-500">
          <Icon name="book" className="h-3.5 w-3.5" />
          <span>Biblioteca</span>
          <Icon name="chevron-right" className="h-3 w-3" />
          <span>Itens</span>
          <Icon name="chevron-right" className="h-3 w-3" />
          <span className="text-slate-300">{ITEM.entry.simplified}</span>
        </div>

        <IdentityHeaderWide />

        <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-4">
            <section className="rounded-2xl bg-slate-900/40 p-4 ring-1 ring-white/10">
              <h2 className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                Trajetória
              </h2>
              <TrajectoryStripBanded />
            </section>

            <section className="rounded-2xl bg-slate-900/40 p-4 ring-1 ring-white/10">
              <div className="mb-1 flex items-baseline justify-between">
                <h2 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
                  Relacionados
                </h2>
                <span className="text-[11px] tabular-nums text-slate-500">
                  {RELATED.length} palavras
                </span>
              </div>
              <ul className="divide-y divide-white/5">
                {relatedRows.map((entry) => (
                  <li key={entry.id}>
                    <RelatedRow entry={entry} />
                  </li>
                ))}
              </ul>
              <div className="mt-3 border-t border-white/5 pt-3">
                <Pager
                  page={relatedPage}
                  pages={Math.ceil(RELATED.length / REL_PER_PAGE)}
                  onChange={setRelatedPage}
                  label={`${(relatedPage - 1) * REL_PER_PAGE + 1}–${Math.min(
                    relatedPage * REL_PER_PAGE,
                    RELATED.length,
                  )} de ${RELATED.length}`}
                />
              </div>
            </section>

            <section className="rounded-2xl bg-slate-900/40 p-4 ring-1 ring-white/10">
              <h2 className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                Ordem dos traços
              </h2>
              <div className="flex items-center gap-8">
                <StrokeMock sizePx={150} />
                <p className="max-w-xs text-sm text-slate-400">
                  Um traço por vez, no quadro com grade 米. Trocar de caractere reinicia a contagem.
                </p>
              </div>
            </section>
          </div>

          <aside className="rounded-2xl bg-slate-900/50 p-4 ring-1 ring-white/10 lg:sticky lg:top-24">
            <ReadingsWorkbench />
          </aside>
        </div>
      </main>
    </AppChrome>
  );
}

function WorkbenchMobile() {
  const [relatedShown, setRelatedShown] = useState(MOBILE_STEP);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = READINGS.find((r) => r.id === selectedId) ?? null;

  return (
    <MobileChrome>
      <div className="space-y-3 p-4">
        <button type="button" className="flex items-center gap-1 text-[11px] text-slate-400">
          <Icon name="chevron-left" className="h-3.5 w-3.5" />
          Biblioteca
        </button>

        <section className="relative rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/40 p-4 ring-1 ring-white/10">
          <div className="absolute top-3 right-3">
            <BadgeRow item={ITEM} />
          </div>
          <ItemGlyph item={ITEM} singleCharPx={58} boxPx={200} />
          <div className="mt-2 flex flex-wrap items-center justify-center gap-1">
            <HskChip level={ITEM.entry.hsk_level} />
            <StateChip state={ITEM.card.state} />
            <LevelChip item={ITEM} />
          </div>
          <p className="mt-1.5 text-center text-[11px] text-slate-400">
            {ITEM.entry.definitions.join(" · ")}
          </p>
        </section>

        <div className="flex flex-wrap gap-x-5 gap-y-1.5 border-y border-white/10 py-2.5">
          {FACTS.slice(0, 4).map(([label, value]) => (
            <div key={label}>
              <div className="text-[9px] tracking-wide text-slate-500 uppercase">{label}</div>
              <div className="text-[11px] tabular-nums text-slate-200">{value}</div>
            </div>
          ))}
        </div>

        <PriorityBar compact />

        <section className="rounded-xl bg-slate-900/40 p-3 ring-1 ring-white/10">
          <ChartLegend />
          <FxChart history={HISTORY} height={120} />
          <div className="-mx-1 mt-2 flex snap-x gap-2 overflow-x-auto px-1 pb-1">
            {HISTORY.slice(0, 6).map((row) => (
              <div key={row.created_at} className="w-40 shrink-0 snap-start">
                <SnapshotCard row={row} />
              </div>
            ))}
          </div>
        </section>

        <details open className="group rounded-xl bg-slate-900/40 ring-1 ring-white/10">
          <summary className="flex cursor-pointer items-center px-3 py-2.5 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            Relacionados
            <span className="ml-auto text-[10px] font-normal normal-case text-slate-600">
              {RELATED.length}
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

        <details className="group rounded-xl bg-slate-900/40 ring-1 ring-white/10">
          <summary className="cursor-pointer px-3 py-2.5 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            Ordem dos traços
          </summary>
          <div className="px-3 pb-4">
            <StrokeMock sizePx={130} />
          </div>
        </details>

        <details open className="group rounded-xl bg-slate-900/40 ring-1 ring-white/10">
          <summary className="flex cursor-pointer items-center px-3 py-2.5 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            Leituras com{" "}
            <span lang="zh-Hans" className="font-hanzi text-slate-200">
              {ITEM.entry.simplified}
            </span>
            <span className="ml-auto text-[10px] font-normal normal-case text-slate-600">
              {READINGS.length}
            </span>
          </summary>
          <div className="px-3 pb-3">
            <div className="divide-y divide-white/5">
              {READINGS.slice(0, 4).map((reading) => (
                <div key={reading.id}>
                  <ReadingRow
                    reading={reading}
                    selected={reading.id === selectedId}
                    onSelect={() => setSelectedId(selectedId === reading.id ? null : reading.id)}
                  />
                  {selected?.id === reading.id && (
                    <div className="pb-2">
                      <ReadingDetail reading={reading} />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="pt-2 text-[10px] text-slate-600">
              Toque numa leitura para abrir o trecho aqui mesmo.
            </p>
          </div>
        </details>
      </div>
    </MobileChrome>
  );
}

export function WorkbenchItem() {
  return (
    <>
      <WorkbenchDesktop />
      <div className="mx-auto max-w-6xl px-6 pb-16">
        <div className="mt-10 flex items-center gap-3">
          <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
            Mobile · 390px
          </span>
          <span className="h-px flex-1 bg-white/10" />
        </div>
        <div className="mt-4 flex justify-center">
          <PhoneFrame caption="Bancada no celular: trajetória rola na horizontal; leituras abrem o trecho em linha, sem sair da página.">
            <WorkbenchMobile />
          </PhoneFrame>
        </div>
      </div>
    </>
  );
}
