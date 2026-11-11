// Variant B — "Abas" (wayfinder #110). A full-width identity header, then a tab
// bar where each section gets its own tab. Only one paginated list is mounted at
// a time, so the page can never grow endless; mobile turns the tabs into a
// scrollable segmented control and swaps paging for "Carregar mais".

import { useState } from "react";
import { PhoneFrame } from "../../PhoneFrame.tsx";
import { Icon } from "../../icons.tsx";
import { FACTS, HISTORY, ITEM, RELATED, STROKES } from "../itemDetailData.ts";
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

type Tab = "overview" | "history" | "strokes" | "related";

const TABS: Array<[Tab, string]> = [
  ["overview", "Visão geral"],
  ["history", "Trajetória"],
  ["strokes", "Traços"],
  ["related", "Relacionados"],
];

const HIST_PER_PAGE = 8;
const REL_PER_PAGE = 8;
const MOBILE_STEP = 4;

function IdentityHeader() {
  return (
    <section className="rounded-2xl bg-gradient-to-br from-slate-900 to-slate-900/30 p-6 ring-1 ring-white/10">
      <div className="flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-5">
          <ItemGlyph item={ITEM} singleCharPx={76} boxPx={220} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-100">{ITEM.entry.definitions[0]}</h1>
              <BadgeRow item={ITEM} />
            </div>
            <p className="mt-0.5 text-sm text-slate-400">
              {ITEM.entry.definitions.slice(1).join(" · ") || "sem outros sentidos"}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <HskChip level={ITEM.entry.hsk_level} />
              <StateChip state={ITEM.card.state} />
              <LevelChip item={ITEM} />
              <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">
                criado 18/09
              </span>
            </div>
          </div>
        </div>
        <div className="ml-auto min-w-[230px]">
          <PriorityBar compact />
        </div>
      </div>
    </section>
  );
}

function TabBar({
  tab,
  onTab,
}: {
  tab: Tab;
  onTab: (tab: Tab) => void;
}) {
  const counts: Record<Tab, string | null> = {
    overview: null,
    history: String(HISTORY.length),
    strokes: `${STROKES.length} chars`,
    related: String(RELATED.length),
  };
  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-white/10">
      {TABS.map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onTab(key)}
          className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
            tab === key
              ? "border-accent-500 text-white"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          {label}
          {counts[key] && (
            <span className="rounded bg-white/5 px-1.5 text-[10px] tabular-nums text-slate-400">
              {counts[key]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function DesktopTabBody({ tab }: { tab: Tab }) {
  const [historyPage, setHistoryPage] = useState(1);
  const [relatedPage, setRelatedPage] = useState(1);

  if (tab === "overview") {
    return (
      <div className="space-y-5">
        <FactsStrip facts={FACTS} />
        <div>
          <div className="mb-1 flex items-center justify-between">
            <ChartLegend />
            <span className="text-[11px] text-slate-500">
              {HISTORY.length} snapshots · desde 18/09
            </span>
          </div>
          <FxChart history={HISTORY} height={190} />
        </div>
      </div>
    );
  }

  if (tab === "history") {
    const pages = Math.ceil(HISTORY.length / HIST_PER_PAGE);
    const rows = HISTORY.slice((historyPage - 1) * HIST_PER_PAGE, historyPage * HIST_PER_PAGE);
    return (
      <div>
        <div className="mb-3 flex items-center justify-between">
          <ChartLegend />
          <span className="text-[11px] text-slate-500">8 por página</span>
        </div>
        <FxChart history={HISTORY} height={150} />
        <div className="mt-3">
          <SnapshotTable rows={rows} />
        </div>
        <div className="mt-3 border-t border-white/5 pt-3">
          <Pager
            page={historyPage}
            pages={pages}
            onChange={setHistoryPage}
            label={`${(historyPage - 1) * HIST_PER_PAGE + 1}–${Math.min(
              historyPage * HIST_PER_PAGE,
              HISTORY.length,
            )} de ${HISTORY.length} snapshots`}
          />
        </div>
      </div>
    );
  }

  if (tab === "strokes") {
    return (
      <div className="grid items-center gap-6 sm:grid-cols-[220px_1fr]">
        <div className="flex justify-center">
          <StrokeMock sizePx={190} />
        </div>
        <div className="space-y-2">
          {STROKES.map((s) => (
            <div
              key={s.character}
              className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 ring-1 ring-white/5"
            >
              <span className="flex items-center gap-2">
                <span lang="zh-Hans" className="font-hanzi text-lg text-slate-200">
                  {s.character}
                </span>
                <span className="text-xs text-slate-400">{s.total} traços</span>
              </span>
              <Icon name="chevron-right" className="h-4 w-4 text-slate-600" />
            </div>
          ))}
          <p className="pt-1 text-[11px] text-slate-500">
            O visualizador revela um traço por vez; sem animação automática.
          </p>
        </div>
      </div>
    );
  }

  const pages = Math.ceil(RELATED.length / REL_PER_PAGE);
  const rows = RELATED.slice((relatedPage - 1) * REL_PER_PAGE, relatedPage * REL_PER_PAGE);
  return (
    <div>
      <ul className="divide-y divide-white/5">
        {rows.map((entry) => (
          <li key={entry.id}>
            <RelatedRow entry={entry} />
          </li>
        ))}
      </ul>
      <div className="mt-3 border-t border-white/5 pt-3">
        <Pager
          page={relatedPage}
          pages={pages}
          onChange={setRelatedPage}
          label={`${(relatedPage - 1) * REL_PER_PAGE + 1}–${Math.min(
            relatedPage * REL_PER_PAGE,
            RELATED.length,
          )} de ${RELATED.length} palavras`}
        />
      </div>
    </div>
  );
}

function TabbedDesktop() {
  const [tab, setTab] = useState<Tab>("overview");
  return (
    <AppChrome>
      <main className="mx-auto max-w-5xl px-6 py-7">
        <div className="mb-4 flex items-center gap-2 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Icon name="book" className="h-3.5 w-3.5" />
            Biblioteca
          </span>
          <Icon name="chevron-right" className="h-3 w-3" />
          <span>Itens</span>
          <Icon name="chevron-right" className="h-3 w-3" />
          <span className="text-slate-300">{ITEM.entry.simplified}</span>
        </div>
        <IdentityHeader />
        <div className="mt-6 rounded-2xl bg-slate-900/40 ring-1 ring-white/10">
          <div className="px-4">
            <TabBar tab={tab} onTab={setTab} />
          </div>
          <div className="p-4">
            <DesktopTabBody tab={tab} />
          </div>
        </div>
      </main>
    </AppChrome>
  );
}

function MobileTabbed() {
  const [tab, setTab] = useState<Tab>("overview");
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
          <div className="flex items-center gap-3">
            <ItemGlyph item={ITEM} singleCharPx={52} boxPx={150} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-100">{ITEM.entry.definitions[0]}</p>
              <p className="truncate text-[11px] text-slate-400">
                {ITEM.entry.definitions.slice(1).join(" · ")}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                <HskChip level={ITEM.entry.hsk_level} />
                <StateChip state={ITEM.card.state} />
                <LevelChip item={ITEM} />
              </div>
            </div>
          </div>
          <div className="mt-3 border-t border-white/5 pt-2.5">
            <PriorityBar compact />
          </div>
        </section>

        <div className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-0.5">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-full px-3 py-1.5 text-[11px] font-medium whitespace-nowrap ${
                tab === key
                  ? "bg-white/10 text-white ring-1 ring-white/15"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="rounded-xl bg-slate-900/40 p-3 ring-1 ring-white/10">
          {tab === "overview" && (
            <div className="space-y-3">
              <FactsStrip facts={FACTS} />
              <div>
                <ChartLegend />
                <FxChart history={HISTORY} height={130} />
              </div>
              <p className="text-[11px] text-slate-500">
                {HISTORY.length} snapshots · {STROKES.length} caracteres · {RELATED.length} palavras
                relacionadas.
              </p>
            </div>
          )}

          {tab === "history" && (
            <div>
              <ChartLegend />
              <FxChart history={HISTORY} height={120} />
              <div className="mt-2 divide-y divide-white/5">
                {HISTORY.slice(0, historyShown).map((row) => (
                  <div
                    key={row.created_at}
                    className="flex items-center justify-between gap-2 py-2"
                  >
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
          )}

          {tab === "strokes" && (
            <div className="space-y-2">
              <StrokeMock sizePx={140} />
              <div className="divide-y divide-white/5">
                {STROKES.map((s) => (
                  <div key={s.character} className="flex items-center justify-between py-2">
                    <span className="flex items-center gap-2">
                      <span lang="zh-Hans" className="font-hanzi text-base text-slate-200">
                        {s.character}
                      </span>
                      <span className="text-[11px] text-slate-400">{s.total} traços</span>
                    </span>
                    <Icon name="chevron-right" className="h-3.5 w-3.5 text-slate-600" />
                  </div>
                ))}
              </div>
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
        </div>
      </div>
    </MobileChrome>
  );
}

export function TabbedItem() {
  return (
    <>
      <TabbedDesktop />
      <div className="mx-auto max-w-5xl px-6 pb-16">
        <div className="mt-10 flex items-center gap-3">
          <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
            Mobile · 390px
          </span>
          <span className="h-px flex-1 bg-white/10" />
        </div>
        <div className="mt-4 flex justify-center">
          <PhoneFrame caption="Abas no celular como 'chips' roláveis; cada aba tem sua própria lista, então nunca há duas listas paginadas na tela ao mesmo tempo.">
            <MobileTabbed />
          </PhoneFrame>
        </div>
      </div>
    </>
  );
}
