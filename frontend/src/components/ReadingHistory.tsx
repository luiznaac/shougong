import type { ReadingSummary } from "../api/types.ts";
import { readingFormatLabel } from "../i18n/readingFormat.ts";
import { formatDate } from "../lib/format.ts";
import type { Presentation } from "../lib/useMediaQuery.ts";
import { EmptyState } from "./EmptyState.tsx";
import { LoadMore } from "./LoadMore.tsx";
import { Pager } from "./Pager.tsx";
import { Panel } from "./Panel.tsx";
import { PanelState } from "./QueryState.tsx";

/** The history rail's one density: explicit pages on desktop, load-more pages on mobile. */
export const READING_HISTORY_PAGE_SIZE = 8;

/**
 * The Leitura history pane. Desktop renders one eight-row summary page behind
 * the rail's own `Pager`; mobile accumulates eight-row pages behind
 * `Carregar mais`. Both read the summary contract only — opening a row is what
 * fetches the full reading, through the page's `useReadingText`.
 */
export function ReadingHistory({
  rows,
  total,
  loading,
  loadingMore = false,
  error,
  selectedId,
  onSelect,
  onRetry,
  presentation,
  page,
  onPageChange,
  onLoadMore,
}: {
  rows: ReadingSummary[];
  total: number;
  loading: boolean;
  loadingMore?: boolean;
  error: unknown;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onRetry: () => void;
  presentation: Presentation;
  page: number;
  onPageChange: (page: number) => void;
  onLoadMore: () => void;
}) {
  return (
    <Panel title="Histórico">
      <PanelState
        isLoading={loading && rows.length === 0}
        loadingLabel="Carregando histórico…"
        loadingRows={6}
        skeletonClass="h-12 w-full"
        error={rows.length === 0 ? error : null}
        errorTitle="Não foi possível carregar o histórico."
        onRetry={onRetry}
      >
        {rows.length === 0 ? (
          <EmptyState
            icon="text"
            title="Nenhuma leitura no histórico"
            description="Gere uma leitura para começar seu histórico."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {error ? (
              <div
                role="alert"
                className="flex items-center justify-between gap-2 rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-300"
              >
                <span>Não foi possível atualizar o histórico.</span>
                <button type="button" onClick={onRetry} className="font-medium underline">
                  Tentar novamente
                </button>
              </div>
            ) : null}

            <ul aria-label="Histórico de leituras" className="divide-y divide-white/5">
              {rows.map((summary) => (
                <li key={summary.id}>
                  <HistoryRow
                    summary={summary}
                    selected={summary.id === selectedId}
                    onSelect={() => onSelect(summary.id)}
                  />
                </li>
              ))}
            </ul>

            {presentation === "desktop" ? (
              <Pager
                page={page}
                total={total}
                shown={rows.length}
                pageSize={READING_HISTORY_PAGE_SIZE}
                onPageChange={onPageChange}
              />
            ) : (
              <LoadMore
                shown={rows.length}
                total={total}
                loading={loadingMore}
                onLoadMore={onLoadMore}
              />
            )}
          </div>
        )}
      </PanelState>
    </Panel>
  );
}

function HistoryRow({
  summary,
  selected,
  onSelect,
}: {
  summary: ReadingSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  const extras =
    summary.extra_word_count > 0
      ? `+${summary.extra_word_count} extra${summary.extra_word_count === 1 ? "" : "s"}`
      : "0 extras";

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`Leitura #${summary.id}, ${readingFormatLabel(summary.format)}`}
      className={`w-full rounded-lg px-2 py-2 text-left transition-colors ${
        selected ? "bg-accent-500/10 ring-1 ring-accent-500/30" : "hover:bg-white/5"
      }`}
    >
      <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
        <span className="shrink-0 tabular-nums">#{summary.id}</span>
        <span className="shrink-0">{readingFormatLabel(summary.format)}</span>
        <span className="min-w-0 flex-1 truncate">
          {summary.topic ?? (summary.topic_generated ? "tema sorteado" : "sem tema")}
        </span>
        <span
          className={`shrink-0 ${summary.extra_word_count > 0 ? "text-amber-400" : "text-slate-600"}`}
        >
          {extras}
        </span>
        <span className="shrink-0 tabular-nums">{formatDate(summary.created_at)}</span>
      </span>
      <span lang="zh-Hans" className="mt-1 block truncate font-hanzi text-sm text-slate-300">
        {summary.preview}
      </span>
    </button>
  );
}
