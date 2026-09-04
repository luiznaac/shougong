import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useBatchImportStudyItems } from "../api/queries.ts";
import { ApiError } from "../api/client.ts";
import { parseStudyItemsCsv } from "../lib/csv.ts";
import type { BatchImportOutcome, BatchRowStatus } from "../api/types.ts";

const STATUS_STYLE: Record<BatchRowStatus, { label: string; className: string }> = {
  created: { label: "criada", className: "bg-emerald-500/15 text-emerald-400" },
  skipped: { label: "pulada", className: "bg-slate-500/15 text-slate-400" },
  error: { label: "erro", className: "bg-rose-500/15 text-rose-400" },
};

export function BatchImport() {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const importMutation = useBatchImportStudyItems();

  const parsed = useMemo(() => parseStudyItemsCsv(text), [text]);
  const report = importMutation.data;

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setFileName(file.name);
    setText(await file.text());
    importMutation.reset();
  };

  const run = () => {
    if (parsed.rows.length > 0) importMutation.mutate(parsed.rows);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Importar itens de estudo (CSV)</h1>
        <p className="mt-1 text-sm text-slate-400">
          Uma linha por item: <code className="text-slate-300">hanzi,pinyin</code>. O pinyin precisa
          usar tons numéricos (ex.: <code className="text-slate-300">xue2 xi2</code>). Cabeçalho é
          opcional. Cada linha é casada com uma entrada existente do dicionário.
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
          onChange={(e) => onFile(e.target.files?.[0])}
          className="mt-1 block w-full text-sm text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-slate-800 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-200 hover:file:bg-slate-700"
        />
      </label>

      <label className="block">
        <span className="text-sm text-slate-400">…ou cole o conteúdo</span>
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setFileName(null);
            importMutation.reset();
          }}
          rows={6}
          placeholder={"学习,xue2 xi2\n你好,ni3 hao3"}
          className="mt-1 w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 font-mono text-sm text-slate-100 outline-none focus:border-accent-500"
        />
      </label>

      <div className="flex items-center gap-3">
        <button
          onClick={run}
          disabled={parsed.rows.length === 0 || importMutation.isPending}
          className="rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-600 disabled:opacity-40"
        >
          {importMutation.isPending ? "Importando…" : "Importar"}
        </button>
        <span className="text-sm text-slate-500">
          {parsed.rows.length} linha{parsed.rows.length === 1 ? "" : "s"} reconhecida
          {parsed.rows.length === 1 ? "" : "s"}
          {fileName ? ` · ${fileName}` : ""}
        </span>
      </div>

      {importMutation.error && (
        <p className="text-sm text-rose-400">
          Falha ao importar:{" "}
          {importMutation.error instanceof ApiError
            ? importMutation.error.message
            : String(importMutation.error)}
        </p>
      )}

      {report && <ResultsPanel outcomes={report.outcomes} created={report.created} skipped={report.skipped} errors={report.errors} />}
    </div>
  );
}

function ResultsPanel({
  outcomes,
  created,
  skipped,
  errors,
}: {
  outcomes: BatchImportOutcome[];
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
            {outcomes.map((o) => {
              const style = STATUS_STYLE[o.status];
              return (
                <tr key={o.row} className="border-t border-white/5">
                  <td className="py-1.5 pr-3 tabular-nums text-slate-500">{o.row}</td>
                  <td className="py-1.5 pr-3 font-hanzi text-slate-100" lang="zh-Hans">
                    {o.hanzi || "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-slate-300">{o.pinyin || "—"}</td>
                  <td className="py-1.5 pr-3">
                    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${style.className}`}>
                      {style.label}
                    </span>
                  </td>
                  <td className="py-1.5 text-slate-400">{o.detail ?? ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
