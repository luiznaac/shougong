import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { keys, useReadingHistory, useReadingHistoryPages, useReadingText } from "../api/queries.ts";
import type { ReadingToken, SavedReadingText } from "../api/types.ts";
import { ReadingArticle } from "../components/ReadingArticle.tsx";
import { ReadingGenerator } from "../components/ReadingGenerator.tsx";
import { READING_HISTORY_PAGE_SIZE, ReadingHistory } from "../components/ReadingHistory.tsx";
import { ReadingTopicsPanel } from "../components/ReadingTopicsPanel.tsx";
import { VocabularyPanel } from "../components/VocabularyPanel.tsx";
import { WordInspector, WordSheet } from "../components/WordInspector.tsx";
import { pageOffset } from "../lib/pagination.ts";
import { useMediaQuery } from "../lib/useMediaQuery.ts";

type Segment = "leitura" | "historico" | "paineis";

const SEGMENTS: { id: Segment; label: string }[] = [
  { id: "leitura", label: "Leitura" },
  { id: "historico", label: "Histórico" },
  { id: "paineis", label: "Painéis" },
];

/**
 * The Leitura workspace. Desktop is three panes inside the shell — a paged
 * history rail, the bounded article with one wrapping generator bar, and the
 * persistent word inspector over the vocabulary/topic accordions. Mobile splits
 * the same surface into Leitura / Histórico / Painéis and turns a word lookup
 * into a sticky bottom card. The history always reads summary rows; only a
 * selected row fetches its full reading.
 */
export function Reading() {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedToken, setSelectedToken] = useState<ReadingToken | null>(null);
  const [segment, setSegment] = useState<Segment>("leitura");

  const desktopHistory = useReadingHistory(
    READING_HISTORY_PAGE_SIZE,
    pageOffset(page, READING_HISTORY_PAGE_SIZE),
    { enabled: isDesktop },
  );
  const mobileHistory = useReadingHistoryPages(READING_HISTORY_PAGE_SIZE, {
    enabled: !isDesktop,
  });

  const rows = isDesktop
    ? (desktopHistory.data?.items ?? [])
    : (mobileHistory.data?.pages.flatMap((summaryPage) => summaryPage.items) ?? []);
  const total = isDesktop
    ? (desktopHistory.data?.total ?? 0)
    : (mobileHistory.data?.pages.at(-1)?.total ?? 0);
  const historyLoading = isDesktop ? desktopHistory.isLoading : mobileHistory.isLoading;
  const historyError = isDesktop ? desktopHistory.error : mobileHistory.error;

  const detail = useReadingText(selectedId);
  const selectedSummary = rows.find((summary) => summary.id === selectedId) ?? null;

  const retryHistory = () => {
    if (isDesktop) void desktopHistory.refetch();
    else void mobileHistory.refetch();
  };

  const selectReading = (id: number) => {
    setSelectedId(id);
    setSelectedToken(null);
    setSegment("leitura");
  };

  const onGenerated = (reading: SavedReadingText) => {
    queryClient.setQueryData(keys.readingText(reading.id), reading);
    setSelectedId(reading.id);
    setSelectedToken(null);
    setPage(1);
    setSegment("leitura");
  };

  const changeSegment = (next: Segment) => {
    setSegment(next);
    if (next !== "leitura") setSelectedToken(null);
  };

  const article = (
    <ReadingArticle
      summary={selectedSummary}
      detail={detail.data}
      isLoading={detail.isLoading}
      error={detail.error}
      onRetry={() => void detail.refetch()}
      onSelectToken={setSelectedToken}
    />
  );

  const history = (
    <ReadingHistory
      rows={rows}
      total={total}
      loading={historyLoading}
      loadingMore={!isDesktop && mobileHistory.isFetchingNextPage}
      error={historyError}
      selectedId={selectedId}
      onSelect={selectReading}
      onRetry={retryHistory}
      presentation={isDesktop ? "desktop" : "mobile"}
      page={page}
      onPageChange={setPage}
      onLoadMore={() => void mobileHistory.fetchNextPage()}
    />
  );

  if (!isDesktop) {
    return (
      <div className="space-y-4">
        <div
          role="tablist"
          aria-label="Seções da leitura"
          className="flex gap-1 rounded-xl bg-slate-900/50 p-1 ring-1 ring-white/10"
        >
          {SEGMENTS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={segment === item.id}
              onClick={() => changeSegment(item.id)}
              className={`min-h-11 flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                segment === item.id
                  ? "bg-accent-500 text-white"
                  : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {segment === "leitura" ? (
          <div className="space-y-4">
            {article}
            <ReadingGenerator presentation="mobile" onGenerated={onGenerated} />
          </div>
        ) : null}

        {segment === "historico" ? history : null}

        {segment === "paineis" ? (
          <div className="space-y-4">
            <VocabularyPanel />
            <ReadingTopicsPanel />
          </div>
        ) : null}

        {selectedToken ? (
          <WordSheet token={selectedToken} onDismiss={() => setSelectedToken(null)} />
        ) : null}
      </div>
    );
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)_300px]">
      <aside className="lg:sticky lg:top-20">{history}</aside>

      <div className="min-w-0 space-y-4">
        <ReadingGenerator presentation="desktop" onGenerated={onGenerated} />
        {article}
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20">
        <WordInspector token={selectedToken} />
        <VocabularyPanel />
        <ReadingTopicsPanel />
      </aside>
    </div>
  );
}
