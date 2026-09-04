import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../api/client.ts";
import { parseStudyItemsCsv } from "../lib/csv.ts";
import type { BatchImportOutcome, BatchImportRowRequest, DictionaryEntry } from "../api/types.ts";

// Client-only states layered on top of the backend's row status: a row starts
// "pending" (not sent yet), becomes "loading" while its request is in flight,
// then settles into whatever the backend reported.
type DisplayStatus = "pending" | "loading" | BatchImportOutcome["status"];

const STATUS_STYLE: Record<DisplayStatus, { label: string; className: string }> = {
  pending: { label: "na fila", className: "bg-slate-500/10 text-slate-500" },
  loading: { label: "enviando", className: "bg-sky-500/15 text-sky-400" },
  created: { label: "criada", className: "bg-emerald-500/15 text-emerald-400" },
  skipped: { label: "pulada", className: "bg-slate-500/15 text-slate-400" },
  error: { label: "erro", className: "bg-rose-500/15 text-rose-400" },
};

function Spinner() {
  return (
    <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-sky-400 border-t-transparent" />
  );
}

export function BatchImport() {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);

  // One slot per row of the current run; undefined until that row's response
  // arrives. `sentRows` is a snapshot of `parsed.rows` taken when the run
  // started, so editing the input mid-run doesn't shift indices under it.
  const [sentRows, setSentRows] = useState<BatchImportRowRequest[]>([]);
  const [outcomes, setOutcomes] = useState<(BatchImportOutcome | undefined)[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [running, setRunning] = useState(false);
  const [resolvingRow, setResolvingRow] = useState<number | null>(null);
  const runIdRef = useRef(0); // bumped on every run so a stale loop stops updating state

  const qc = useQueryClient();
  const parsed = useMemo(() => parseStudyItemsCsv(text), [text]);

  const onFile = async (file: File | undefined) => {
    if (!file || running) return;
    setFileName(file.name);
    setText(await file.text());
    setOutcomes([]);
  };

  const run = async () => {
    const rows = parsed.rows;
    if (rows.length === 0 || running) return;

    const runId = ++runIdRef.current;
    setSentRows(rows);
    setOutcomes(new Array(rows.length).fill(undefined));
    setRunning(true);

    // Sent one row at a time (not all 300+ in a single request): each await
    // yields to the browser between requests, so the UI stays responsive and
    // the results table fills in live instead of freezing until everything
    // is done.
    for (let i = 0; i < rows.length; i++) {
      if (runIdRef.current !== runId) return; // a newer run replaced this one
      setCurrentIndex(i);
      try {
        const response = await api.batchImportStudyItems([rows[i]]);
        const outcome = response.outcomes[0];
        if (runIdRef.current !== runId) return;
        setOutcomes((prev) => {
          const next = [...prev];
          next[i] = outcome ? { ...outcome, row: i + 1 } : undefined;
          return next;
        });
      } catch (e) {
        if (runIdRef.current !== runId) return;
        const detail = e instanceof ApiError || e instanceof Error ? e.message : String(e);
        setOutcomes((prev) => {
          const next = [...prev];
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
      qc.invalidateQueries({ queryKey: ["study-items"] });
    }
  };

  // Resolve an ambiguous row by adding the candidate the user picked. Reuses
  // the single-item endpoint, which already checks first and only inserts if
  // the entry isn't queued yet — same 409 "already there" handling as /add.
  const pickCandidate = async (rowIndex: number, entryId: number) => {
    setResolvingRow(rowIndex);
    try {
      const item = await api.addStudyItem(entryId);
      setOutcomes((prev) => {
        const next = [...prev];
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
      qc.invalidateQueries({ queryKey: ["study-items"] });
    } catch (e) {
      const alreadyQueued = e instanceof ApiError && e.status === 409;
      setOutcomes((prev) => {
        const next = [...prev];
        const current = next[rowIndex];
        if (current) {
          next[rowIndex] = {
            ...current,
            status: alreadyQueued ? "skipped" : "error",
            detail: alreadyQueued
              ? "já está na fila"
              : `falha ao confirmar: ${e instanceof Error ? e.message : String(e)}`,
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
  const created = outcomes.filter((o) => o?.status === "created").length;
  const skipped = outcomes.filter((o) => o?.status === "skipped").length;
  const errors = outcomes.filter((o) => o?.status === "error").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Importar itens de estudo (CSV)</h1>
        <p className="mt-1 text-sm text-slate-400">
          Uma linha por item: <code className="text-slate-300">hanzi,pinyin</code>. O pinyin precisa
          usar tons numéricos (ex.: <code className="text-slate-300">xue2 xi2</code>). Cabeçalho é
          opcional. Cada linha é casada com uma entrada existente do dicionário e enviada
          individualmente, para você acompanhar o progresso.
        </p>
        <Link to="/add" className="mt-2 inline-block text-sm text-accent-500 hover:underline">
          ← Adicionar item a item
        </Link>
      </div>

      <label className="block">
        <span className="text-sm text-slate-400">Arquivo CSV</span>
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={running}
          onChange={(e) => onFile(e.target.files?.[0])}
          className="mt-1 block w-full text-sm text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-200 hover:file:bg-slate-700 disabled:opacity-50"
        />
      </label>

      <label className="block">
        <span className="text-sm text-slate-400">…ou cole o conteúdo</span>
        <textarea
          value={text}
          disabled={running}
          onChange={(e) => {
            setText(e.target.value);
            setFileName(null);
            setOutcomes([]);
          }}
          rows={6}
          placeholder={"学习,xue2 xi2\n你好,ni3 hao3"}
          className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-accent-500 disabled:opacity-50"
        />
      </label>

      <div className="flex items-center gap-3">
        <button
          onClick={run}
          disabled={parsed.rows.length === 0 || running}
          className="rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600 disabled:opacity-40"
        >
          {running ? `Importando… (${sentCount}/${sentRows.length})` : "Importar"}
        </button>
        <span className="text-sm text-slate-500">
          {parsed.rows.length} linha{parsed.rows.length === 1 ? "" : "s"} reconhecida
          {parsed.rows.length === 1 ? "" : "s"}
          {fileName ? ` · ${fileName}` : ""}
        </span>
      </div>

      {sentRows.length > 0 && (
        <ResultsPanel
          rows={sentRows}
          outcomes={outcomes}
          currentIndex={currentIndex}
          resolvingRow={resolvingRow}
          onPickCandidate={pickCandidate}
          created={created}
          skipped={skipped}
          errors={errors}
        />
      )}
    </div>
  );
}

function ResultsPanel({
  rows,
  outcomes,
  currentIndex,
  resolvingRow,
  onPickCandidate,
  created,
  skipped,
  errors,
}: {
  rows: BatchImportRowRequest[];
  outcomes: (BatchImportOutcome | undefined)[];
  currentIndex: number;
  resolvingRow: number | null;
  onPickCandidate: (rowIndex: number, entryId: number) => void;
  created: number;
  skipped: number;
  errors: number;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-slate-900/50 p-5">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
        Resultado — {created} criada{created === 1 ? "" : "s"} · {skipped} pulada
        {skipped === 1 ? "" : "s"} · {errors} com erro
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-1 pr-3">#</th>
              <th className="py-1 pr-3">Hanzi</th>
              <th className="py-1 pr-3">Pinyin</th>
              <th className="py-1 pr-3">Status</th>
              <th className="py-1">Detalhe</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const outcome = outcomes[i];
              const status: DisplayStatus = outcome ? outcome.status : i === currentIndex ? "loading" : "pending";
              const style = STATUS_STYLE[status];
              // an "error" row that still carries candidates: either several
              // entries matched exactly, or none did but the hanzi has other
              // readings — offer them so the user can add one by hand anyway.
              const hasCandidates = status === "error" && (outcome?.candidates.length ?? 0) > 0;
              return (
                <tr key={i} className="border-t border-white/5 align-top">
                  <td className="py-1.5 pr-3 tabular-nums text-slate-500">{i + 1}</td>
                  <td className="py-1.5 pr-3 font-hanzi text-slate-100" lang="zh-Hans">
                    {row.hanzi || "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-slate-300">{row.pinyin || "—"}</td>
                  <td className="py-1.5 pr-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs font-medium ${style.className}`}
                    >
                      {status === "loading" && <Spinner />}
                      {style.label}
                    </span>
                  </td>
                  <td className="py-1.5 text-slate-400">
                    {hasCandidates ? (
                      <CandidatePicker
                        detail={outcome!.detail}
                        candidates={outcome!.candidates}
                        resolving={resolvingRow === i}
                        onPick={(entryId) => onPickCandidate(i, entryId)}
                      />
                    ) : (
                      outcome?.detail ?? ""
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
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
      {detail && <p>{detail}</p>}
      <p className="text-xs text-slate-500">
        {candidates.length > 1 ? "Escolha qual usar:" : "Adicionar assim mesmo?"}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {candidates.map((c) => (
          <button
            key={c.id}
            disabled={resolving}
            onClick={() => onPick(c.id)}
            className="inline-flex items-center gap-1 rounded border border-white/10 bg-slate-800 px-2 py-1 text-xs text-slate-200 transition-colors hover:border-accent-500 hover:text-accent-400 disabled:opacity-50"
          >
            {resolving && <Spinner />}#{c.id} {c.pinyin} — {c.definitions.slice(0, 2).join("; ") || "sem definição"}
          </button>
        ))}
      </div>
    </div>
  );
}
