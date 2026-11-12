import type { ReactNode } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useItemHistory, useStudyItem } from "../api/queries.ts";
import type { StudyItem, StudyItemHistory } from "../api/types.ts";
import { Hanzi } from "../components/Hanzi.tsx";
import { HskChip } from "../components/HskChip.tsx";
import { ItemBadges } from "../components/ItemBadges.tsx";
import { ItemPrioritySection } from "../components/ItemPrioritySection.tsx";
import { ItemReadings } from "../components/ItemReadings.tsx";
import { ItemTrajectoryChart } from "../components/ItemTrajectoryChart.tsx";
import { Panel } from "../components/Panel.tsx";
import { Pinyin } from "../components/Pinyin.tsx";
import { PanelError, PanelLoading } from "../components/QueryState.tsx";
import { RelatedEntries } from "../components/RelatedEntries.tsx";
import { Skeleton } from "../components/Skeleton.tsx";
import { SrsStageChip } from "../components/SrsStageChip.tsx";
import { StrokePlayer } from "../components/StrokePlayer.tsx";
import { fsrsFacts } from "../lib/itemFacts.ts";
import { PATHS } from "../lib/navigation.ts";
import { type Presentation, useMediaQuery } from "../lib/useMediaQuery.ts";

/**
 * Biblioteca's item detail. Desktop: identity header with the priority controls,
 * a plain-language FSRS facts line, then Trajetória → Leituras → Relacionados in
 * the main column with only the stroke player in the sticky rail. Mobile keeps
 * the same identity/facts/priority order and puts the open stroke card first
 * among the study panels, with a compact 104px viewer visible without scrolling.
 */
export function StudyItemPage() {
  const { id } = useParams();
  const location = useLocation();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const itemId = Number(id);
  const item = useStudyItem(itemId);
  const history = useItemHistory(itemId);
  const listHref = (location.state as { from?: string } | null)?.from ?? PATHS.biblioteca;

  if (item.isLoading) return <ItemPageSkeleton />;

  if (item.error || !item.data) {
    return (
      <div className="space-y-3">
        <PanelError
          title="Não foi possível carregar este item."
          error={item.error ?? "Item não encontrado."}
          onRetry={() => void item.refetch()}
        />
        <p className="text-center">
          <Link to={listHref} className="text-sm text-slate-400 hover:text-slate-200">
            Voltar para Biblioteca
          </Link>
        </p>
      </div>
    );
  }

  const studyItem = item.data;
  const word = studyItem.entry.simplified;
  const readingsTitle = (
    <>
      Leituras com <span className="font-hanzi text-slate-300">{word}</span>
    </>
  );

  return (
    // Remount the panels when the route hops to another item: a cached
    // related-word link must not keep the previous selected reading, related
    // page or stroke picker.
    <div key={studyItem.id} className="space-y-4">
      <Link to={listHref} className="inline-block text-xs text-slate-500 hover:text-slate-300">
        ← Biblioteca
      </Link>

      <IdentityHeader
        item={studyItem}
        compact={!isDesktop}
        priority={isDesktop ? <ItemPrioritySection item={studyItem} variant="inline" /> : null}
      />

      <FactsLine item={studyItem} />

      {isDesktop ? (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-4">
            <TrajectoryPanel history={history} layout="desktop" />

            <Panel title={readingsTitle}>
              <ItemReadings entryId={studyItem.entry.id} word={word} layout="desktop" />
            </Panel>

            <Panel title="Relacionados">
              <RelatedEntries entryId={studyItem.entry.id} layout="desktop" />
            </Panel>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-20">
            <Panel title="Ordem dos traços">
              <StrokePlayer word={word} sizePx={175} />
            </Panel>
          </aside>
        </div>
      ) : (
        <div className="space-y-3">
          <ItemPrioritySection item={studyItem} variant="compact" />

          <Panel title="Ordem dos traços">
            <StrokePlayer word={word} sizePx={104} />
          </Panel>

          <TrajectoryPanel history={history} layout="mobile" />

          <Panel title={readingsTitle}>
            <ItemReadings entryId={studyItem.entry.id} word={word} layout="mobile" />
          </Panel>

          <Panel title="Relacionados">
            <RelatedEntries entryId={studyItem.entry.id} layout="mobile" />
          </Panel>
        </div>
      )}
    </div>
  );
}

function IdentityHeader({
  item,
  priority,
  compact = false,
}: {
  item: StudyItem;
  priority: ReactNode;
  compact?: boolean;
}) {
  const [lead, ...rest] = item.entry.definitions;
  return (
    <header
      className={`rounded-2xl bg-slate-900/40 ring-1 ring-white/10 ${compact ? "p-3" : "p-5"}`}
    >
      <div className={`flex flex-wrap items-center ${compact ? "gap-3" : "gap-5"}`}>
        <div className={`flex items-center ${compact ? "gap-3" : "gap-4"}`}>
          <div className="flex flex-col items-center">
            <Pinyin
              value={item.entry.pinyin}
              className={compact ? "text-sm font-light" : "text-lg font-light"}
            />
            <Hanzi
              text={item.entry.simplified}
              singleCharPx={compact ? 48 : 88}
              boxPx={compact ? 150 : 220}
              className="text-slate-50"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className={`font-semibold text-white ${compact ? "text-lg" : "text-2xl"}`}>
                {lead ?? item.entry.simplified}
              </h1>
              <ItemBadges item={item} />
            </div>
            {rest.length > 0 && !compact ? (
              <p className={`mt-1 text-slate-400 ${compact ? "line-clamp-1 text-xs" : "text-sm"}`}>
                {rest.join(" · ")}
              </p>
            ) : null}
            <div className={`flex flex-wrap items-center gap-1.5 ${compact ? "mt-1" : "mt-2"}`}>
              <HskChip level={item.entry.hsk_level} />
              <SrsStageChip card={item.card} />
            </div>
          </div>
        </div>
        {priority ? <div className="ml-auto">{priority}</div> : null}
      </div>
    </header>
  );
}

function FactsLine({ item }: { item: StudyItem }) {
  return (
    <dl className="flex flex-wrap gap-x-8 gap-y-2 border-y border-white/10 py-3">
      {fsrsFacts(item).map((fact) => (
        <div key={fact.label}>
          <dt className="text-[10px] tracking-wide text-slate-500 uppercase">{fact.label}</dt>
          <dd className="text-sm tabular-nums text-slate-200" title={fact.title}>
            {fact.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function TrajectoryPanel({
  history,
  layout,
}: {
  history: {
    data: StudyItemHistory[] | undefined;
    isLoading: boolean;
    error: unknown;
    refetch: () => unknown;
  };
  layout: Presentation;
}) {
  return (
    <Panel title="Trajetória">
      {history.isLoading ? (
        <PanelLoading label="Carregando trajetória…" rows={1} skeletonClass="h-52 w-full" />
      ) : history.error ? (
        <PanelError
          title="Não foi possível carregar a trajetória."
          error={history.error}
          onRetry={() => void history.refetch()}
        />
      ) : (
        <ItemTrajectoryChart history={history.data ?? []} layout={layout} />
      )}
    </Panel>
  );
}

function ItemPageSkeleton() {
  return (
    <output className="block space-y-4">
      <span className="sr-only">Carregando item…</span>
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-64 w-full" />
    </output>
  );
}
