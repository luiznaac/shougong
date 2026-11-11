// Variant D — "Ficha com abas" (wayfinder #110). A blend: A's sticky identity
// rail (hanzi header, priority, FSRS facts, stroke order), C's always-visible
// trajectory band, and B's one-list-at-a-time tab discipline — now with a third
// list: the generated readings that contain the word. Mobile keeps the rail as a
// header and swaps numeric paging for "Carregar mais".

import { useState } from "react";
import { PhoneFrame } from "../../PhoneFrame.tsx";
import { Icon } from "../../icons.tsx";
import { FACTS, HISTORY, ITEM, READINGS, RELATED } from "../itemDetailData.ts";
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
  ReadingRow,
  RelatedRow,
  SnapshotTable,
  StateChip,
  StrokeMock,
} from "../parts.tsx";

type ListTab = "history" | "related" | "readings";

const LIST_TABS: Array<[ListTab, string, number]> = [
  ["history", "Trajetória", HISTORY.length],
  ["related", "Relacionados", RELATED.length],
  ["readings", "Leituras", READINGS.length],
];

const HIST_PER_PAGE = 8;
const REL_PER_PAGE = 8;
const READ_PER_PAGE = 3;
const MOBILE_STEP = 4;

function IdentityCardB() {
  return (
    <section className="relative rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/40 p-5 ring-1 ring-white/10">
      <div className="absolute top-4 right-4">
        <BadgeRow item={ITEM} />
      </div>
      <ItemGlyph item={ITEM} singleCharPx={80} boxPx={260} />
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

function ListTabs({
  tab,
  onTab,
  variant = "underline",
}: {
  tab: ListTab;
  onTab: (tab: ListTab) => void;
  variant?: "underline" | "chips";
}) {
  if (variant === "chips") {
    return (
      <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5">
        {LIST_TABS.map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            onClick={() => onTab(key)}
            className={`flex items-center gap-1 rounded-full px-2.5 py-1.5 text-[11px] font-medium whitespace-nowrap ${
              tab === key
                ? "bg-white/10 text-white ring-1 ring-white/15"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {label}
            <span className="text-[9px] tabular-nums text-slate-500">{count}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 border-b border-white/10">
      {LIST_TABS.map(([key, label, count]) => (
        <button
          key={key}
          type="button"
          onClick={() => onTab(key)}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
            tab === key
              ? "border-accent-500 text-white"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          {label}
          <span className="rounded bg-white/5 px-1.5 text-[10px] tabular-nums text-slate-400">
            {count}
          </span>
        </button>
      ))}
    </div>
  );
}

function FichaDesktop() {
  const [tab, setTab] = useState<ListTab>("history");
  const [historyPage, setHistoryPage] = useState(1);
  const [relatedPage, setRelatedPage] = useState(1);
  const [readingPage, setReadingPage] = useState(1);

  const historyRows = HISTORY.slice((historyPage - 1) * HIST_PER_PAGE, historyPage * HIST_PER_PAGE);
  const relatedRows = RELATED.slice((relatedPage - 1) * REL_PER_PAGE, relatedPage * REL_PER_PAGE);
  const readingRows = READINGS.slice(
    (readingPage - 1) * READ_PER_PAGE,
    readingPage * READ_PER_PAGE,
  );

  return (
    <AppChrome>
      <main className="mx-auto max-w-6xl px-6 py-7">
        <div className="mb-5 flex items-center gap-2 text-xs text-slate-500">
          <Icon name="book" className="h-3.5 w-3.5" />
          <span>Biblioteca</span>
          <Icon name="chevron-right" className="h-3 w-3" />
          <span>Itens</span>
          <Icon name="chevron-right" className="h-3 w-3" />
          <span className="text-slate-300">{ITEM.entry.simplified}</span>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-3 lg:sticky lg:top-24">
            <IdentityCardB />
            <section className="rounded-2xl bg-slate-900/40 p-4 ring-1 ring-white/10">
              <h2 className="mb-2 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
                Prioridade
              </h2>
              <PriorityBar compact />
            </section>
            <section className="rounded-2xl bg-slate-900/40 p-4 ring-1 ring-white/10">
              <h2 className="mb-2 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
                Fatos FSRS
              </h2>
              <FactsStrip facts={FACTS} />
            </section>
            <section className="rounded-2xl bg-slate-900/40 p-4 ring-1 ring-white/10">
              <h2 className="mb-2 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
                Ordem dos traços
              </h2>
              <StrokeMock sizePx={130} />
            </section>
          </aside>

          <div className="min-w-0 space-y-4">
            <section className="rounded-2xl bg-slate-900/40 p-4 ring-1 ring-white/10">
              <div className="mb-1 flex items-center justify-between">
                <h2 className="text-xs font-semibold tracking-wide text-slate-400 uppercase">
                  Trajetória FSRS
                </h2>
                <ChartLegend />
              </div>
              <FxChart history={HISTORY} height={160} />
            </section>

            <section className="rounded-2xl bg-slate-900/40 ring-1 ring-white/10">
              <div className="px-4">
                <ListTabs tab={tab} onTab={setTab} />
              </div>
              <div className="p-4">
                {tab === "history" && (
                  <div>
                    <SnapshotTable rows={historyRows} />
                    <div className="mt-3 border-t border-white/5 pt-3">
                      <Pager
                        page={historyPage}
                        pages={Math.ceil(HISTORY.length / HIST_PER_PAGE)}
                        onChange={setHistoryPage}
                        label={`${(historyPage - 1) * HIST_PER_PAGE + 1}–${Math.min(
                          historyPage * HIST_PER_PAGE,
                          HISTORY.length,
                        )} de ${HISTORY.length} snapshots`}
                      />
                    </div>
                  </div>
                )}

                {tab === "related" && (
                  <div>
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
                        )} de ${RELATED.length} palavras`}
                      />
                    </div>
                  </div>
                )}

                {tab === "readings" && (
                  <div>
                    <p className="mb-2 text-[11px] text-slate-500">
                      {READINGS.length} leituras geradas contêm{" "}
                      <span lang="zh-Hans" className="font-hanzi text-slate-300">
                        {ITEM.entry.simplified}
                      </span>
                      .
                    </p>
                    <ul className="divide-y divide-white/5">
                      {readingRows.map((reading) => (
                        <li key={reading.id}>
                          <ReadingRow reading={reading} />
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 border-t border-white/5 pt-3">
                      <Pager
                        page={readingPage}
                        pages={Math.ceil(READINGS.length / READ_PER_PAGE)}
                        onChange={setReadingPage}
                        label={`${(readingPage - 1) * READ_PER_PAGE + 1}–${Math.min(
                          readingPage * READ_PER_PAGE,
                          READINGS.length,
                        )} de ${READINGS.length} leituras`}
                      />
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>
    </AppChrome>
  );
}

function FichaMobile() {
  const [tab, setTab] = useState<ListTab>("history");
  const [historyShown, setHistoryShown] = useState(MOBILE_STEP);
  const [relatedShown, setRelatedShown] = useState(MOBILE_STEP);
  const [readingsShown, setReadingsShown] = useState(2);

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
          <ItemGlyph item={ITEM} singleCharPx={60} boxPx={200} />
          <div className="mt-2 flex flex-wrap items-center justify-center gap-1">
            <HskChip level={ITEM.entry.hsk_level} />
            <StateChip state={ITEM.card.state} />
            <LevelChip item={ITEM} />
          </div>
          <p className="mt-1.5 text-center text-[11px] text-slate-400">
            {ITEM.entry.definitions.join(" · ")}
          </p>
        </section>

        <section className="rounded-xl bg-slate-900/40 p-3 ring-1 ring-white/10">
          <PriorityBar compact />
        </section>

        <details open className="group rounded-xl bg-slate-900/40 ring-1 ring-white/10">
          <summary className="cursor-pointer px-3 py-2.5 text-[10px] font-semibold tracking-wide text-slate-400 uppercase">
            Fatos FSRS
          </summary>
          <div className="px-3 pb-3">
            <FactsStrip facts={FACTS} />
          </div>
        </details>

        <section className="rounded-xl bg-slate-900/40 p-3 ring-1 ring-white/10">
          <ChartLegend />
          <FxChart history={HISTORY} height={120} />
        </section>

        <div className="rounded-xl bg-slate-900/40 p-3 ring-1 ring-white/10">
          <ListTabs tab={tab} onTab={setTab} variant="chips" />
          <div className="mt-3">
            {tab === "history" && (
              <div>
                <div className="divide-y divide-white/5">
                  {HISTORY.slice(0, historyShown).map((row) => (
                    <div key={row.created_at} className="flex items-center justify-between py-2">
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
                <LoadMore
                  shown={historyShown}
                  total={HISTORY.length}
                  onMore={() => setHistoryShown(historyShown + MOBILE_STEP)}
                />
              </div>
            )}

            {tab === "related" && (
              <div>
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
            )}

            {tab === "readings" && (
              <div>
                <ul className="divide-y divide-white/5">
                  {READINGS.slice(0, readingsShown).map((reading) => (
                    <li key={reading.id}>
                      <ReadingRow reading={reading} />
                    </li>
                  ))}
                </ul>
                <LoadMore
                  shown={readingsShown}
                  total={READINGS.length}
                  onMore={() => setReadingsShown(readingsShown + 2)}
                />
              </div>
            )}
          </div>
        </div>

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

export function FichaTabsItem() {
  return (
    <>
      <FichaDesktop />
      <div className="mx-auto max-w-6xl px-6 pb-16">
        <div className="mt-10 flex items-center gap-3">
          <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
            Mobile · 390px
          </span>
          <span className="h-px flex-1 bg-white/10" />
        </div>
        <div className="mt-4 flex justify-center">
          <PhoneFrame caption="Ficha com abas no celular: as três listas viram chips; só uma está montada por vez e cada uma carrega mais sob demanda.">
            <FichaMobile />
          </PhoneFrame>
        </div>
      </div>
    </>
  );
}
