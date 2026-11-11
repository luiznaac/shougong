import { useState } from "react";
import { useItemReadings, useReadingText } from "../api/queries.ts";
import type { ReadingMatch, ReadingSummary, SavedReadingText } from "../api/types.ts";
import { readingFormatLabel } from "../i18n/readingFormat.ts";
import { formatDate } from "../lib/format.ts";
import type { Presentation } from "../lib/useMediaQuery.ts";
import { EmptyState } from "./EmptyState.tsx";
import { LoadMore } from "./LoadMore.tsx";
import { PanelState } from "./QueryState.tsx";

/**
 * Readings containing this item's word. The list is the shipped token-free
 * summary contract (`GET /reading-texts?entry_id=…`): format, topic, model,
 * extra-word count, date and preview, in a bounded internally scrolling pane.
 * Selecting a row is what fetches the full reading; on mobile its detail expands
 * inline under the tapped row, on desktop it sits below the list.
 */
export function ItemReadings({
  entryId,
  word,
  layout,
}: {
  entryId: number;
  word: string;
  layout: Presentation;
}) {
  const readings = useItemReadings(entryId);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const summaries = readings.data?.pages.flatMap((page) => page.items) ?? [];
  const total = readings.data?.pages.at(-1)?.total ?? 0;
  const selected = summaries.find((summary) => summary.id === selectedId) ?? null;
  const detail = useReadingText(selectedId);

  const select = (id: number) => setSelectedId((current) => (current === id ? null : id));

  return (
    <PanelState
      isLoading={readings.isLoading}
      loadingLabel="Carregando leituras…"
      skeletonClass="h-14 w-full"
      error={readings.error}
      errorTitle="Não foi possível carregar as leituras."
      onRetry={() => void readings.refetch()}
    >
      {summaries.length === 0 ? (
        <EmptyState
          icon="text"
          title={`Nenhuma leitura com ${word} ainda`}
          description="Gere um texto na Leitura que use esta palavra para vê-lo aqui."
        />
      ) : (
        <div className="space-y-3">
          <div className="max-h-72 space-y-0.5 overflow-y-auto pr-1">
            <ul aria-label={`Leituras com ${word}`} className="divide-y divide-white/5">
              {summaries.map((summary) => (
                <li key={summary.id}>
                  <SummaryRow
                    summary={summary}
                    selected={summary.id === selectedId}
                    onSelect={() => select(summary.id)}
                  />
                  {layout === "mobile" && selected?.id === summary.id ? (
                    <div className="pb-2">
                      <ReadingDetail
                        summary={summary}
                        detail={detail.data}
                        isLoading={detail.isLoading}
                        error={detail.error}
                        compact
                      />
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>

            <LoadMore
              shown={summaries.length}
              total={total}
              loading={readings.isFetchingNextPage}
              onLoadMore={() => void readings.fetchNextPage()}
            />
          </div>

          {layout === "desktop" ? (
            selected ? (
              <ReadingDetail
                summary={selected}
                detail={detail.data}
                isLoading={detail.isLoading}
                error={detail.error}
              />
            ) : (
              <p className="rounded-xl bg-slate-950/30 px-3 py-6 text-center text-sm text-slate-500 ring-1 ring-white/5">
                Selecione uma leitura para ver o trecho e os detalhes.
              </p>
            )
          ) : null}
        </div>
      )}
    </PanelState>
  );
}

function SummaryRow({
  summary,
  selected,
  onSelect,
}: {
  summary: ReadingSummary;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`w-full rounded-lg px-2 py-2.5 text-left transition-colors ${
        selected ? "bg-accent-500/10 ring-1 ring-accent-500/30" : "hover:bg-white/5"
      }`}
    >
      <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
        <FormatChip format={summary.format} />
        <span className="truncate">{summary.topic ?? "tema sorteado"}</span>
        <span className="truncate font-mono">{summary.model}</span>
        {summary.extra_word_count > 0 ? (
          <span className="shrink-0 text-amber-400">+{summary.extra_word_count}</span>
        ) : null}
        <span className="ml-auto shrink-0 tabular-nums">{formatDate(summary.created_at)}</span>
      </span>
      <span className="mt-1 block truncate font-hanzi text-sm text-slate-300" lang="zh-Hans">
        {summary.preview}
      </span>
    </button>
  );
}

function ReadingDetail({
  summary,
  detail,
  isLoading,
  error,
  compact = false,
}: {
  summary: ReadingSummary;
  detail: SavedReadingText | undefined;
  isLoading: boolean;
  error: unknown;
  compact?: boolean;
}) {
  return (
    <section
      aria-label="Leitura selecionada"
      className={`rounded-xl bg-slate-950/50 ring-1 ring-white/10 ${compact ? "p-2" : "p-3"}`}
    >
      <MatchSnippet summary={summary} size={compact ? "sm" : "base"} />

      <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
        <FormatChip format={summary.format} />
        <span className="truncate">{summary.topic ?? "tema sorteado"}</span>
        <span className="font-mono">{summary.model}</span>
        <span className="tabular-nums">{summary.token_count} tokens</span>
        <span className="tabular-nums">
          {summary.attempt_count === 1 ? "1 tentativa" : `${summary.attempt_count} tentativas`}
        </span>
        <span className="ml-auto tabular-nums">{formatDate(summary.created_at)}</span>
      </div>

      {isLoading ? (
        <p className="mt-1 text-[11px] text-slate-500">Carregando leitura…</p>
      ) : error ? (
        <p role="alert" className="mt-1 text-[11px] text-rose-400">
          Falha ao carregar o texto completo.
        </p>
      ) : detail ? (
        <p className="mt-1 text-[11px] text-slate-500">
          {detail.extra_words.length > 0 ? (
            <span className="text-amber-400">
              {detail.extra_words.join(" ")} fora do vocabulário
            </span>
          ) : (
            <span className="text-emerald-300/80">só vocabulário conhecido</span>
          )}
        </p>
      ) : null}
    </section>
  );
}

function MatchSnippet({
  summary,
  size,
}: {
  summary: ReadingSummary;
  size: "sm" | "base";
}) {
  const match: ReadingMatch | null = summary.match;
  return (
    <p
      lang="zh-Hans"
      className={`font-hanzi leading-relaxed ${size === "base" ? "text-base" : "text-sm"}`}
    >
      {match ? (
        <>
          <span className="text-slate-500">{match.before}</span>
          <mark className="rounded bg-accent-500/20 px-0.5 text-accent-200">{match.hit}</mark>
          <span className="text-slate-300">{match.after}</span>
        </>
      ) : (
        <span className="text-slate-300">{summary.preview}</span>
      )}
    </p>
  );
}

function FormatChip({ format }: { format: ReadingSummary["format"] }) {
  return (
    <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">
      {readingFormatLabel(format)}
    </span>
  );
}
