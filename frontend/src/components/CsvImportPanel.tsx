import { useMemo, useRef, useState } from "react";
import { ApiError } from "../api/client.ts";
import { useAddImportRefresh, useAddStudyItem, useBatchImportStudyItems } from "../api/queries.ts";
import type { BatchImportOutcome, BatchImportRowRequest, DictionaryEntry } from "../api/types.ts";
import { CSV_RESULT_PAGE_SIZE } from "../lib/addImport.ts";
import { parseStudyItemsCsv } from "../lib/csv.ts";
import { DataList, type DataListColumn } from "./DataList.tsx";
import { EmptyState } from "./EmptyState.tsx";
import { Pager } from "./Pager.tsx";
import { Panel } from "./Panel.tsx";
import { Icon } from "./icons.tsx";

// Client-only states layered on top of the backend's row status: a row starts
// "pending" (not sent yet), becomes "loading" while its request is in flight,
// then settles into whatever the backend reported.
type DisplayStatus = "pending" | "loading" | BatchImportOutcome["status"];

const STATUS_STYLE: Record<DisplayStatus, { label: string; className: string }> = {
  pending: { label: "na fila", className: "bg-slate-500/10 text-slate-400 ring-slate-500/20" },
  loading: { label: "enviando", className: "bg-sky-500/15 text-sky-300 ring-sky-500/20" },
  created: {
    label: "criada",
    className: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/20",
  },
  skipped: { label: "pulada", className: "bg-slate-500/15 text-slate-400 ring-slate-500/20" },
  error: { label: "erro", className: "bg-rose-500/15 text-rose-300 ring-rose-500/20" },
};

interface CsvResultRow {
  index: number;
  request: BatchImportRowRequest;
  outcome: BatchImportOutcome | undefined;
  status: DisplayStatus;
}

function Spinner() {
  return (
    <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border-2 border-sky-300 border-t-transparent" />
  );
}

function StatusPill({ status }: { status: DisplayStatus }) {
  const style = STATUS_STYLE[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ring-1 ${style.className}`}
    >
      {status === "loading" ? <Spinner /> : null}
      {style.label}
    </span>
  );
}

function SummaryTiles({
  created,
  skipped,
  errors,
}: {
  created: number;
  skipped: number;
  errors: number;
}) {
  const tiles = [
    { label: "criadas", value: created, tone: "text-emerald-300" },
    { label: "puladas", value: skipped, tone: "text-slate-300" },
    { label: "com erro", value: errors, tone: "text-rose-300" },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {tiles.map((tile) => (
        <div
          key={tile.label}
          aria-label={`${tile.label}: ${tile.value}`}
          className="rounded-lg bg-slate-950/50 px-3 py-2 ring-1 ring-white/5"
        >
          <div className={`text-lg font-semibold tabular-nums ${tile.tone}`}>{tile.value}</div>
          <div className="text-[10px] uppercase tracking-wide text-slate-500">{tile.label}</div>
        </div>
      ))}
    </div>
  );
}

/**
 * Biblioteca's CSV pane: a file chip, live per-row progress, the
 * created/skipped/error tiles and the row results twelve at a time. Ambiguous
 * rows carry their candidates inline, so one pick resolves that row without
 * restarting the batch.
 */
export function CsvImportPanel() {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [readingFile, setReadingFile] = useState(false);

  // One slot per row of the current run; undefined until that row's response
  // arrives. `sentRows` is a snapshot of `parsed.rows` taken when the run
  // started, so editing the input mid-run doesn't shift indices under it.
  const [sentRows, setSentRows] = useState<BatchImportRowRequest[]>([]);
  const [outcomes, setOutcomes] = useState<(BatchImportOutcome | undefined)[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [running, setRunning] = useState(false);
  const [resolvingRow, setResolvingRow] = useState<number | null>(null);
  const [resultsPage, setResultsPage] = useState(1);
  const runIdRef = useRef(0); // bumped on every run so a stale loop stops updating state

  const batchImport = useBatchImportStudyItems();
  const addItem = useAddStudyItem();
  const refreshAfterImport = useAddImportRefresh();
  const parsed = useMemo(() => parseStudyItemsCsv(text), [text]);

  const onFile = async (file: File | undefined) => {
    if (!file || running) return;
    setReadingFile(true);
    try {
      const content = await file.text();
      setFileName(file.name);
      setText(content);
      setOutcomes([]);
      setSentRows([]);
      setResultsPage(1);
      setFileError(null);
    } catch {
      setFileError("Não foi possível ler o arquivo.");
    } finally {
      setReadingFile(false);
    }
  };

  const run = async () => {
    const rows = parsed.rows;
    if (rows.length === 0 || running) return;

    const runId = ++runIdRef.current;
    setSentRows(rows);
    setOutcomes(new Array(rows.length).fill(undefined));
    setResultsPage(1);
    setRunning(true);

    // Sent one row at a time (not all at once): each await yields to the browser
    // between requests, so the UI stays responsive and the results fill in live.
    for (let i = 0; i < rows.length; i++) {
      if (runIdRef.current !== runId) return; // a newer run replaced this one
      setCurrentIndex(i);
      try {
        const response = await batchImport.mutateAsync([rows[i]]);
        const outcome = response.outcomes[0];
        if (runIdRef.current !== runId) return;
        setOutcomes((previous) => {
          const next = [...previous];
          next[i] = outcome ? { ...outcome, row: i + 1 } : undefined;
          return next;
        });
      } catch (caught) {
        if (runIdRef.current !== runId) return;
        const detail = caught instanceof Error ? caught.message : String(caught);
        setOutcomes((previous) => {
          const next = [...previous];
          next[i] = {
            row: i + 1,
            hanzi: rows[i].hanzi,
            pinyin: rows[i].pinyin,
            status: "error",
            study_item_id: null,
            detail: `falha ao enviar: ${detail}`,
            candidates: [],
          };
          return next;
        });
      }
    }

    if (runIdRef.current === runId) {
      setCurrentIndex(-1);
      setRunning(false);
      refreshAfterImport();
    }
  };

  // Resolve an ambiguous row by adding the candidate the user picked. Reuses
  // the single-item endpoint, which already checks first and only inserts if
  // the entry isn't queued yet — same 409 "already there" handling as search.
  const pickCandidate = async (rowIndex: number, entryId: number) => {
    setResolvingRow(rowIndex);
    try {
      const item = await addItem.mutateAsync(entryId);
      setOutcomes((previous) => {
        const next = [...previous];
        const current = next[rowIndex];
        if (current) {
          next[rowIndex] = {
            ...current,
            status: "created",
            study_item_id: item.id,
            detail: null,
            candidates: [],
          };
        }
        return next;
      });
    } catch (caught) {
      const alreadyQueued = caught instanceof ApiError && caught.status === 409;
      setOutcomes((previous) => {
        const next = [...previous];
        const current = next[rowIndex];
        if (current) {
          next[rowIndex] = {
            ...current,
            status: alreadyQueued ? "skipped" : "error",
            detail: alreadyQueued
              ? "já está na fila"
              : `falha ao confirmar: ${caught instanceof Error ? caught.message : String(caught)}`,
            candidates: alreadyQueued ? [] : current.candidates,
          };
        }
        return next;
      });
    } finally {
      setResolvingRow(null);
    }
  };

  const sentCount = outcomes.filter(Boolean).length;
  const created = outcomes.filter((outcome) => outcome?.status === "created").length;
  const skipped = outcomes.filter((outcome) => outcome?.status === "skipped").length;
  const errors = outcomes.filter((outcome) => outcome?.status === "error").length;
  const progress = sentRows.length === 0 ? 0 : Math.round((sentCount / sentRows.length) * 100);

  const resultRows: CsvResultRow[] = sentRows.map((request, index) => {
    const outcome = outcomes[index];
    return {
      index,
      request,
      outcome,
      status: outcome ? outcome.status : index === currentIndex ? "loading" : "pending",
    };
  });
  const pageRows = resultRows.slice(
    (resultsPage - 1) * CSV_RESULT_PAGE_SIZE,
    resultsPage * CSV_RESULT_PAGE_SIZE,
  );
  const shownResults = Math.min(
    sentRows.length,
    (resultsPage - 1) * CSV_RESULT_PAGE_SIZE + pageRows.length,
  );

  const columns: DataListColumn<CsvResultRow>[] = [
    {
      key: "hanzi",
      label: "Hanzi",
      render: (row) => (
        <span className="inline-flex items-baseline gap-2">
          <span className="text-xs tabular-nums text-slate-500">{row.index + 1}</span>
          <span className="font-hanzi text-base" lang="zh-Hans">
            {row.request.hanzi || "—"}
          </span>
        </span>
      ),
    },
    {
      key: "pinyin",
      label: "Pinyin",
      render: (row) => row.request.pinyin || "—",
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <StatusPill status={row.status} />,
    },
    {
      key: "detail",
      label: "Detalhe",
      secondary: true,
      render: (row) => <ResultDetail row={row} resolving={resolvingRow} onPick={pickCandidate} />,
    },
  ];

  return (
    <Panel
      title="Importar CSV"
      action={
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-white/10 px-2.5 py-1 text-[11px] font-medium text-slate-300 transition-colors hover:bg-white/5">
          <Icon name="upload" size={14} />
          Escolher arquivo
          <input
            type="file"
            accept=".csv,text/csv"
            disabled={running}
            aria-label="Arquivo CSV"
            onChange={(event) => void onFile(event.target.files?.[0])}
            className="sr-only"
          />
        </label>
      }
    >
      <div className="space-y-4">
        {fileName ? (
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-white/15 bg-slate-950/40 px-3 py-2.5">
            <Icon name="upload" size={18} className="text-accent-400" />
            <p className="min-w-0 flex-1 truncate text-xs font-medium text-slate-200">{fileName}</p>
            <button
              type="button"
              aria-label="Remover arquivo"
              onClick={() => {
                setFileName(null);
                setText("");
                setSentRows([]);
                setOutcomes([]);
              }}
              className="rounded p-1 text-slate-500 hover:text-slate-200"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        ) : null}

        <label className="block">
          <span className="text-xs text-slate-500">…ou cole o conteúdo</span>
          <textarea
            value={text}
            disabled={running}
            onChange={(event) => {
              setText(event.target.value);
              setFileName(null);
              setSentRows([]);
              setOutcomes([]);
              setFileError(null);
            }}
            rows={4}
            placeholder={"学习,xue2 xi2\n你好,ni3 hao3"}
            aria-label="Conteúdo do CSV"
            className="mt-1 w-full rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-accent-500 disabled:opacity-50"
          />
        </label>

        {readingFile ? (
          <output className="block text-xs text-slate-500">Lendo arquivo…</output>
        ) : null}

        {fileError ? (
          <p role="alert" className="text-sm text-rose-400">
            {fileError}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void run()}
            disabled={parsed.rows.length === 0 || running}
            className="rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600 disabled:opacity-40"
          >
            Importar
          </button>
          <span className="text-xs text-slate-500">
            {parsed.rows.length} linha{parsed.rows.length === 1 ? "" : "s"} reconhecida
            {parsed.rows.length === 1 ? "" : "s"}
          </span>
        </div>

        {running ? (
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs">
              <span className="text-slate-400">
                {`Importando… ${sentCount} de ${sentRows.length.toLocaleString("pt-BR")}`}
              </span>
              <span className="tabular-nums text-slate-500">{progress}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-accent-500 transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : null}

        {sentRows.length === 0 ? (
          <EmptyState
            icon="upload"
            title="Escolha um arquivo CSV"
            description="Uma linha por item: hanzi,pinyin. O pinyin precisa usar tons numéricos (ex.: xue2 xi2). Cabeçalho é opcional."
          />
        ) : (
          <div className="space-y-3">
            <SummaryTiles created={created} skipped={skipped} errors={errors} />
            <DataList
              rows={pageRows}
              columns={columns}
              rowKey={(row) => row.index}
              label="Resultados da importação"
            />
            <Pager
              page={resultsPage}
              total={sentRows.length}
              shown={shownResults}
              pageSize={CSV_RESULT_PAGE_SIZE}
              onPageChange={setResultsPage}
            />
          </div>
        )}
      </div>
    </Panel>
  );
}

function ResultDetail({
  row,
  resolving,
  onPick,
}: {
  row: CsvResultRow;
  resolving: number | null;
  onPick: (rowIndex: number, entryId: number) => void;
}) {
  const candidates = row.status === "error" ? (row.outcome?.candidates ?? []) : [];
  if (candidates.length > 0) {
    return (
      <CandidatePicker
        detail={row.outcome?.detail}
        candidates={candidates}
        resolving={resolving === row.index}
        onPick={(entryId) => onPick(row.index, entryId)}
      />
    );
  }
  return <span>{row.outcome?.detail ?? ""}</span>;
}

function CandidatePicker({
  detail,
  candidates,
  resolving,
  onPick,
}: {
  detail: string | null | undefined;
  candidates: DictionaryEntry[];
  resolving: boolean;
  onPick: (entryId: number) => void;
}) {
  return (
    <div className="space-y-1">
      {detail ? <p>{detail}</p> : null}
      <p className="text-xs text-slate-500">
        {candidates.length > 1 ? "Escolha qual usar:" : "Adicionar assim mesmo?"}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {candidates.map((candidate) => (
          <button
            type="button"
            key={candidate.id}
            disabled={resolving}
            onClick={() => onPick(candidate.id)}
            className="inline-flex items-center gap-1 rounded border border-white/10 bg-slate-800 px-2 py-1 text-xs text-slate-200 transition-colors hover:border-accent-500 hover:text-accent-400 disabled:opacity-50"
          >
            {resolving ? <Spinner /> : null}#{candidate.id} {candidate.pinyin} —{" "}
            {candidate.definitions.slice(0, 2).join("; ") || "sem definição"}
          </button>
        ))}
      </div>
    </div>
  );
}
