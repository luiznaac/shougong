import { useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "../api/client.ts";
import { useAddStudyItem, useDictionaryPageQueries, useStudyItems } from "../api/queries.ts";
import type { DictionaryEntry } from "../api/types.ts";
import { DICTIONARY_PAGE_SIZE, dictionaryPageRequests, dictionaryShown } from "../lib/addImport.ts";
import type { Presentation } from "../lib/useMediaQuery.ts";
import { DataList, type DataListColumn } from "./DataList.tsx";
import { EmptyState } from "./EmptyState.tsx";
import { Hanzi } from "./Hanzi.tsx";
import { HskChip } from "./HskChip.tsx";
import { LoadMore } from "./LoadMore.tsx";
import { Pager } from "./Pager.tsx";
import { Panel } from "./Panel.tsx";
import { Pinyin } from "./Pinyin.tsx";
import { PanelState } from "./QueryState.tsx";

const ADDED_FEEDBACK_MS = 600;

/**
 * Biblioteca's dictionary pane: five server rows per page, the HSK level and a
 * per-row enqueue control whose feedback flips "Adicionado" to "Na fila".
 * Desktop pages with the numbered pager; mobile accumulates behind "Carregar
 * mais". It never invents results — the server's order and total are rendered.
 */
export function DictionarySearchPanel({ presentation }: { presentation: Presentation }) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [shown, setShown] = useState(DICTIONARY_PAGE_SIZE);
  const [feedback, setFeedback] = useState<Record<number, "added" | "queued">>({});
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const debounceTimer = useRef<number | null>(null);
  const feedbackTimers = useRef<number[]>([]);

  const term = debounced.trim();
  const requests = dictionaryPageRequests(presentation, page, shown);
  const pages = useDictionaryPageQueries(term, requests);
  const results = pages.flatMap((result) => result.data?.items ?? []);
  const total = pages[0]?.data?.total ?? 0;
  const error = pages.find((result) => result.error)?.error ?? null;
  const isLoading = results.length === 0 && pages.some((result) => result.isLoading);
  const isFetching = pages.some((result) => result.isFetching);

  const { data: studyItems } = useStudyItems();
  const queuedIds = useMemo(
    () => new Set((studyItems ?? []).map((item) => item.entry.id)),
    [studyItems],
  );
  const addMutation = useAddStudyItem();

  useEffect(
    () => () => {
      if (debounceTimer.current !== null) window.clearTimeout(debounceTimer.current);
      for (const timer of feedbackTimers.current) window.clearTimeout(timer);
    },
    [],
  );

  const search = (value: string) => {
    setQ(value);
    if (debounceTimer.current !== null) window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(() => {
      setDebounced(value);
      setPage(1);
      setShown(DICTIONARY_PAGE_SIZE);
    }, 250);
  };

  const queueLocally = (entryId: number) => {
    setFeedback((current) => ({ ...current, [entryId]: "queued" }));
  };

  const markAdded = (entryId: number) => {
    setFeedback((current) => ({ ...current, [entryId]: "added" }));
    const timer = window.setTimeout(() => {
      setFeedback((current) =>
        current[entryId] === "added" ? { ...current, [entryId]: "queued" } : current,
      );
    }, ADDED_FEEDBACK_MS);
    feedbackTimers.current.push(timer);
  };

  const add = async (entryId: number) => {
    try {
      await addMutation.mutateAsync(entryId);
      setRowErrors((current) => {
        if (!(entryId in current)) return current;
        const next = { ...current };
        delete next[entryId];
        return next;
      });
      markAdded(entryId);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 409) {
        queueLocally(entryId);
        return;
      }
      const message =
        caught instanceof Error ? caught.message : "Não foi possível adicionar esta palavra.";
      setRowErrors((current) => ({ ...current, [entryId]: message }));
    }
  };

  const retry = () => {
    for (const result of pages) void result.refetch();
  };

  const columns: DataListColumn<DictionaryEntry>[] = [
    {
      key: "word",
      label: "Palavra",
      render: (entry) => (
        <Hanzi text={entry.simplified} singleCharPx={26} boxPx={84} className="text-slate-100" />
      ),
    },
    { key: "pinyin", label: "Pinyin", render: (entry) => <Pinyin value={entry.pinyin} /> },
    {
      key: "meaning",
      label: "Significado",
      render: (entry) => (
        <div className="min-w-0">
          <p className="truncate">{entry.definitions.join("; ") || "—"}</p>
          {rowErrors[entry.id] ? (
            <p className="text-xs text-rose-400">{rowErrors[entry.id]}</p>
          ) : null}
        </div>
      ),
    },
  ];

  const enqueueControl = (entry: DictionaryEntry) => {
    const feedbackStatus = feedback[entry.id];
    const enqueued = queuedIds.has(entry.id) || feedbackStatus !== undefined;
    const justAdded = feedbackStatus === "added";
    const label = justAdded ? "Adicionado" : enqueued ? "Na fila" : "Adicionar";
    return (
      <button
        type="button"
        disabled={enqueued || addMutation.isPending}
        aria-label={label}
        onClick={() => void add(entry.id)}
        className={`inline-flex min-h-8 items-center rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
          justAdded
            ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30"
            : enqueued
              ? "bg-slate-800 text-slate-500"
              : "bg-accent-500 text-white hover:bg-accent-600 disabled:opacity-50"
        }`}
      >
        {label}
      </button>
    );
  };

  const shownRows = Math.min(total, dictionaryShown(presentation, page, results.length));

  return (
    <Panel
      title="Buscar no dicionário"
      action={
        term ? <span className="text-xs tabular-nums text-slate-500">{total} entradas</span> : null
      }
    >
      <div className="space-y-4">
        <input
          type="search"
          value={q}
          onChange={(event) => search(event.target.value)}
          placeholder="你好, ni3hao3, hello…"
          aria-label="Buscar no dicionário"
          className="w-full rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-base text-slate-100 outline-none focus:border-accent-500"
        />

        {term === "" ? (
          <EmptyState
            icon="search"
            title="Busque no dicionário"
            description="Digite hanzi, pinyin ou uma tradução para enfileirar palavras."
          />
        ) : (
          <PanelState
            isLoading={isLoading}
            loadingLabel="Buscando no dicionário…"
            loadingRows={DICTIONARY_PAGE_SIZE}
            skeletonClass="h-12 w-full"
            error={results.length === 0 ? error : null}
            errorTitle="Não foi possível buscar no dicionário."
            onRetry={retry}
          >
            {results.length === 0 ? (
              <EmptyState
                icon="search"
                title={`Nenhum resultado para “${debounced}”.`}
                description="Tente o hanzi, o pinyin com tons numéricos ou uma tradução."
              />
            ) : (
              <div className="space-y-4">
                {error ? (
                  <div
                    role="alert"
                    className="flex items-center justify-between gap-3 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300"
                  >
                    <span>Não foi possível carregar mais resultados.</span>
                    <button type="button" onClick={retry} className="font-medium underline">
                      Tentar novamente
                    </button>
                  </div>
                ) : null}
                <DataList
                  rows={results}
                  columns={columns}
                  rowKey={(entry) => entry.id}
                  chips={(entry) => (
                    <>
                      <HskChip level={entry.hsk_level} />
                      {enqueueControl(entry)}
                    </>
                  )}
                  label="Resultados do dicionário"
                />
                {presentation === "desktop" ? (
                  <Pager
                    page={page}
                    total={total}
                    shown={shownRows}
                    pageSize={DICTIONARY_PAGE_SIZE}
                    onPageChange={setPage}
                  />
                ) : (
                  <LoadMore
                    shown={shownRows}
                    total={total}
                    loading={isFetching}
                    onLoadMore={() => setShown((current) => current + DICTIONARY_PAGE_SIZE)}
                  />
                )}
              </div>
            )}
          </PanelState>
        )}
      </div>
    </Panel>
  );
}
