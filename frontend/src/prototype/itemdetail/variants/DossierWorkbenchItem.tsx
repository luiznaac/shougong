// Variant G — "Dossiê" (wayfinder #110). Everything at once, with the trajectory
// demoted: the identity header carries the facts, context gets the main column
// (readings master-detail, then related words), and the rail shows progress as a
// number + sparkline behind a "Ver trajetória" drawer.

import { useState } from "react";
import { PhoneFrame } from "../../PhoneFrame.tsx";
import { Icon } from "../../icons.tsx";
import { FACTS, HISTORY, ITEM, READINGS, RELATED } from "../itemDetailData.ts";
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
  Pager,
  PriorityBar,
  ReadingDetail,
  ReadingRow,
  RelatedRow,
  SnapshotTable,
  Sparkline,
  StateChip,
  StrokeMock,
} from "../parts.tsx";

const REL_PER_PAGE = 6;
const DRAWER_PER_PAGE = 8;
const MOBILE_STEP = 4;

function IdentityHeader() {
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

function ProgressCard({ onOpen }: { onOpen: () => void }) {
  return (
    <section className="rounded-2xl bg-slate-900/40 p-4 ring-1 ring-white/10">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Progresso</h2>
        <LevelChip item={ITEM} />
      </div>
      <div className="mt-1.5 flex items-end justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold tabular-nums text-slate-100">21,4 d</div>
          <div className="text-[11px] text-slate-500">estabilidade · dificuldade 4,82</div>
          <div className="mt-1 text-[11px] text-slate-400">Próximo review 14 de nov</div>
        </div>
        <Sparkline history={HISTORY} className="h-11 w-28" />
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="mt-3 w-full rounded-lg border border-white/10 py-1.5 text-xs text-slate-300 hover:bg-white/5"
      >
        Ver trajetória completa
      </button>
    </section>
  );
}

function FactsCard() {
  return (
    <section className="rounded-2xl bg-slate-900/40 p-4 ring-1 ring-white/10">
      <h2 className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">Fatos</h2>
      <dl className="space-y-1 text-[11px]">
        {FACTS.slice(2).map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-2">
            <dt className="truncate text-slate-500">{label}</dt>
            <dd className="shrink-0 tabular-nums text-slate-300">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ReadingsPane({ compact = false }: { compact?: boolean }) {
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
          className={`space-y-0.5 overflow-y-auto pr-1 ${compact ? "max-h-52" : "max-h-[18rem]"}`}
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

function TrajectoryDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [page, setPage] = useState(1);
  if (!open) return null;
  const rows = HISTORY.slice((page - 1) * DRAWER_PER_PAGE, page * DRAWER_PER_PAGE);

  return (
    <div className="fixed inset-0 z-40">
      <button
        type="button"
        aria-label="Fechar trajetória"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm"
      />
      <div className="absolute top-0 right-0 flex h-full w-full max-w-[520px] flex-col bg-slate-950 shadow-2xl ring-1 ring-white/10">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Trajetória</h2>
            <p className="text-[11px] text-slate-500">{HISTORY.length} snapshots · detalhe</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <ChartLegend />
          <FxChart history={HISTORY} height={170} />
          <div className="mt-4">
            <SnapshotTable rows={rows} />
          </div>
          <div className="mt-3 border-t border-white/5 pt-3">
            <Pager
              page={page}
              pages={Math.ceil(HISTORY.length / DRAWER_PER_PAGE)}
              onChange={setPage}
              label={`${(page - 1) * DRAWER_PER_PAGE + 1}–${Math.min(
                page * DRAWER_PER_PAGE,
                HISTORY.length,
              )} de ${HISTORY.length}`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function DossierDesktop() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [relPage, setRelPage] = useState(1);
  const relRows = RELATED.slice((relPage - 1) * REL_PER_PAGE, relPage * REL_PER_PAGE);

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

        <IdentityHeader />

        <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-4">
            <section className="rounded-2xl bg-slate-900/40 p-4 ring-1 ring-white/10">
              <ReadingsPane />
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
                {relRows.map((entry) => (
                  <li key={entry.id}>
                    <RelatedRow entry={entry} />
                  </li>
                ))}
              </ul>
              <div className="mt-3 border-t border-white/5 pt-3">
                <Pager
                  page={relPage}
                  pages={Math.ceil(RELATED.length / REL_PER_PAGE)}
                  onChange={setRelPage}
                  label={`${(relPage - 1) * REL_PER_PAGE + 1}–${Math.min(
                    relPage * REL_PER_PAGE,
                    RELATED.length,
                  )} de ${RELATED.length}`}
                />
              </div>
            </section>
          </div>

          <aside className="space-y-3 lg:sticky lg:top-24">
            <ProgressCard onOpen={() => setDrawerOpen(true)} />
            <section className="rounded-2xl bg-slate-900/40 p-4 ring-1 ring-white/10">
              <h2 className="mb-2 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                Traços
              </h2>
              <StrokeMock sizePx={130} />
            </section>
            <FactsCard />
          </aside>
        </div>
      </main>
      <TrajectoryDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </AppChrome>
  );
}

function DossierMobile() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [relShown, setRelShown] = useState(MOBILE_STEP);
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
          <ItemGlyph item={ITEM} singleCharPx={56} boxPx={200} />
          <div className="mt-2 flex flex-wrap items-center justify-center gap-1">
            <HskChip level={ITEM.entry.hsk_level} />
            <StateChip state={ITEM.card.state} />
            <LevelChip item={ITEM} />
          </div>
          <p className="mt-1.5 text-center text-[11px] text-slate-400">
            {ITEM.entry.definitions.join(" · ")}
          </p>
        </section>

        <PriorityBar compact />

        <section className="rounded-xl bg-slate-900/40 p-3 ring-1 ring-white/10">
          <div className="flex items-end justify-between gap-2">
            <div>
              <div className="text-[10px] tracking-wide text-slate-500 uppercase">Progresso</div>
              <div className="text-lg font-semibold tabular-nums text-slate-100">21,4 d</div>
              <div className="text-[10px] text-slate-500">próximo review 14 de nov</div>
            </div>
            <Sparkline history={HISTORY} className="h-9 w-24" />
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(!drawerOpen)}
            className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-white/10 py-1.5 text-[11px] text-slate-300"
          >
            {drawerOpen ? "Fechar trajetória" : "Ver trajetória completa"}
            <Icon
              name="chevron-right"
              className={`h-3 w-3 transition-transform ${drawerOpen ? "-rotate-90" : "rotate-90"}`}
            />
          </button>
          {drawerOpen && (
            <div className="mt-2 border-t border-white/5 pt-2">
              <ChartLegend />
              <FxChart history={HISTORY} height={120} />
              <div className="mt-2 divide-y divide-white/5">
                {HISTORY.slice(0, 6).map((row) => (
                  <div key={row.created_at} className="flex items-center justify-between py-1.5">
                    <span className="text-[11px] tabular-nums text-slate-300">
                      {new Date(row.created_at).toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </span>
                    <StateChip state={row.state} />
                    <span className="text-[11px] tabular-nums text-slate-400">
                      {row.stability.toFixed(1)} d
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

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
          </div>
        </details>

        <details open className="group rounded-xl bg-slate-900/40 ring-1 ring-white/10">
          <summary className="flex cursor-pointer items-center px-3 py-2.5 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            Relacionados
            <span className="ml-auto text-[10px] font-normal normal-case text-slate-600">
              {RELATED.length}
            </span>
          </summary>
          <div className="px-3 pb-3">
            <ul className="divide-y divide-white/5">
              {RELATED.slice(0, relShown).map((entry) => (
                <li key={entry.id}>
                  <RelatedRow entry={entry} />
                </li>
              ))}
            </ul>
            <LoadMore
              shown={relShown}
              total={RELATED.length}
              onMore={() => setRelShown(relShown + MOBILE_STEP)}
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
      </div>
    </MobileChrome>
  );
}

export function DossierWorkbenchItem() {
  return (
    <>
      <DossierDesktop />
      <div className="mx-auto max-w-6xl px-6 pb-16">
        <div className="mt-10 flex items-center gap-3">
          <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
            Mobile · 390px
          </span>
          <span className="h-px flex-1 bg-white/10" />
        </div>
        <div className="mt-4 flex justify-center">
          <PhoneFrame caption="Dossiê no celular: progresso é só número + sparkline; a trajetória completa abre em linha, sob demanda.">
            <DossierMobile />
          </PhoneFrame>
        </div>
      </div>
    </>
  );
}
