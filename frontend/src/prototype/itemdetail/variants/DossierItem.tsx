// Variant A — "Ficha" (wayfinder #110). A sticky identity rail holds the hanzi
// header, priority, FSRS facts and stroke order; the main column carries the two
// paginated lists as bounded cards, each with its own page control. On mobile the
// sections collapse into accordions and the lists become "Carregar mais".

import { useState } from "react";
import { PhoneFrame } from "../../PhoneFrame.tsx";
import { Icon } from "../../icons.tsx";
import { FACTS, HISTORY, ITEM, RELATED } from "../itemDetailData.ts";
import {
  AppChrome,
  BadgeRow,
  ChartLegend,
  FactsStrip,
  FxChart,
  HskChip,
  ItemGlyph,
  LevelChip,
  LoadMore,
  MobileChrome,
  Pager,
  PriorityBar,
  RelatedRow,
  SnapshotTable,
  StateChip,
  StrokeMock,
} from "../parts.tsx";

const HIST_PER_PAGE = 6;
const REL_PER_PAGE = 6;
const MOBILE_STEP = 3;

function SectionCard({
  title,
  meta,
  children,
  className = "",
}: {
  title: string;
  meta?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl bg-slate-900/40 p-4 ring-1 ring-white/10 ${className}`}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">{title}</h2>
        {meta && <span className="text-[11px] text-slate-500">{meta}</span>}
      </div>
      {children}
    </section>
  );
}

function IdentityCard() {
  return (
    <section className="relative rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/40 p-5 ring-1 ring-white/10">
      <div className="absolute top-4 right-4">
        <BadgeRow item={ITEM} />
      </div>
      <ItemGlyph item={ITEM} singleCharPx={84} boxPx={280} />
      <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
        <HskChip level={ITEM.entry.hsk_level} />
        <StateChip state={ITEM.card.state} />
        <LevelChip item={ITEM} />
      </div>
      <ul className="mt-4 space-y-1 border-t border-white/5 pt-3 text-sm text-slate-300">
        {ITEM.entry.definitions.map((d) => (
          <li key={d} className="flex gap-2">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-600" />
            {d}
          </li>
        ))}
      </ul>
    </section>
  );
}

function DossierDesktop() {
  const [historyPage, setHistoryPage] = useState(1);
  const [relatedPage, setRelatedPage] = useState(1);

  const historyPages = Math.ceil(HISTORY.length / HIST_PER_PAGE);
  const historyRows = HISTORY.slice((historyPage - 1) * HIST_PER_PAGE, historyPage * HIST_PER_PAGE);
  const relatedPages = Math.ceil(RELATED.length / REL_PER_PAGE);
  const relatedRows = RELATED.slice((relatedPage - 1) * REL_PER_PAGE, relatedPage * REL_PER_PAGE);

  return (
    <AppChrome>
      <main className="mx-auto max-w-6xl px-6 py-7">
        <div className="mb-5 flex items-center gap-2 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Icon name="book" className="h-3.5 w-3.5" />
            Biblioteca
          </span>
          <Icon name="chevron-right" className="h-3 w-3" />
          <span>Itens</span>
          <Icon name="chevron-right" className="h-3 w-3" />
          <span className="text-slate-300">{ITEM.entry.simplified}</span>
          <span className="ml-auto flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1">
            <Icon name="chevron-left" className="h-3 w-3" />
            Voltar aos itens
          </span>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[330px_minmax(0,1fr)]">
          <aside className="space-y-3 lg:sticky lg:top-24">
            <IdentityCard />
            <SectionCard title="Prioridade">
              <PriorityBar />
            </SectionCard>
            <SectionCard title="Fatos FSRS">
              <FactsStrip facts={FACTS} />
            </SectionCard>
            <SectionCard title="Ordem dos traços" meta="2 caracteres">
              <StrokeMock sizePx={140} />
            </SectionCard>
          </aside>

          <div className="min-w-0 space-y-4">
            <SectionCard
              title="Trajetória"
              meta={`${historyRows.length} de ${HISTORY.length} snapshots`}
            >
              <ChartLegend />
              <div className="mb-3">
                <FxChart history={HISTORY} height={168} />
              </div>
              <SnapshotTable rows={historyRows} />
              <div className="mt-3 border-t border-white/5 pt-3">
                <Pager
                  page={historyPage}
                  pages={historyPages}
                  onChange={setHistoryPage}
                  label={`${(historyPage - 1) * HIST_PER_PAGE + 1}–${Math.min(
                    historyPage * HIST_PER_PAGE,
                    HISTORY.length,
                  )} de ${HISTORY.length}`}
                />
              </div>
            </SectionCard>

            <SectionCard title="Relacionados" meta={`${RELATED.length} palavras`}>
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
                  pages={relatedPages}
                  onChange={setRelatedPage}
                  label={`${(relatedPage - 1) * REL_PER_PAGE + 1}–${Math.min(
                    relatedPage * REL_PER_PAGE,
                    RELATED.length,
                  )} de ${RELATED.length}`}
                />
              </div>
            </SectionCard>
          </div>
        </div>
      </main>
    </AppChrome>
  );
}

function DossierMobile() {
  const [historyShown, setHistoryShown] = useState(MOBILE_STEP);
  const [relatedShown, setRelatedShown] = useState(MOBILE_STEP);

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
          <ItemGlyph item={ITEM} singleCharPx={64} boxPx={220} />
          <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
            <HskChip level={ITEM.entry.hsk_level} />
            <StateChip state={ITEM.card.state} />
            <LevelChip item={ITEM} />
          </div>
          <p className="mt-2 text-center text-[11px] text-slate-400">
            {ITEM.entry.definitions.join(" · ")}
          </p>
        </section>

        <section className="rounded-xl bg-slate-900/40 p-3 ring-1 ring-white/10">
          <h2 className="mb-2 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
            Prioridade
          </h2>
          <PriorityBar compact />
        </section>

        <details open className="group rounded-xl bg-slate-900/40 ring-1 ring-white/10">
          <summary className="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            <Icon name="chart" className="h-3.5 w-3.5 text-slate-500" />
            Fatos FSRS
            <Icon
              name="chevron-right"
              className="ml-auto h-3 w-3 rotate-90 text-slate-600 transition-transform group-open:-rotate-90"
            />
          </summary>
          <div className="px-3 pb-3">
            <FactsStrip facts={FACTS} />
          </div>
        </details>

        <details className="group rounded-xl bg-slate-900/40 ring-1 ring-white/10">
          <summary className="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            <Icon name="text" className="h-3.5 w-3.5 text-slate-500" />
            Ordem dos traços
            <span className="ml-auto text-[10px] font-normal normal-case text-slate-600">
              2 caracteres
            </span>
          </summary>
          <div className="px-3 pb-4">
            <StrokeMock sizePx={130} />
          </div>
        </details>

        <details open className="group rounded-xl bg-slate-900/40 ring-1 ring-white/10">
          <summary className="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            <Icon name="clock" className="h-3.5 w-3.5 text-slate-500" />
            Trajetória
            <span className="ml-auto text-[10px] font-normal normal-case text-slate-600">
              {HISTORY.length} snapshots
            </span>
          </summary>
          <div className="px-3 pb-3">
            <ChartLegend />
            <FxChart history={HISTORY} height={140} />
            <div className="mt-2 divide-y divide-white/5">
              {HISTORY.slice(0, historyShown).map((row) => (
                <div key={row.created_at} className="flex items-center justify-between gap-2 py-2">
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
                  <span className="text-[11px] tabular-nums text-slate-500">
                    dif. {row.difficulty.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
            <LoadMore
              shown={historyShown}
              total={HISTORY.length}
              onMore={() => setHistoryShown(historyShown + MOBILE_STEP)}
            />
          </div>
        </details>

        <details className="group rounded-xl bg-slate-900/40 ring-1 ring-white/10">
          <summary className="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            <Icon name="grid" className="h-3.5 w-3.5 text-slate-500" />
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

export function DossierItem() {
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
          <PhoneFrame caption="Ficha no celular: seções em acordeão; listas com 'Carregar mais'; traços e relacionados fechados por padrão.">
            <DossierMobile />
          </PhoneFrame>
        </div>
      </div>
    </>
  );
}
