import { useEffect, useMemo, useState } from "react";
import { useAddStudyItem, useDictionarySearch, useStudyItems } from "../api/queries.ts";
import { Pinyin } from "../components/Pinyin.tsx";
import { Hanzi } from "../components/Hanzi.tsx";
import { ApiError } from "../api/client.ts";

export function AddItems() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const { data: results, isFetching } = useDictionarySearch(debounced);
  const { data: studyItems } = useStudyItems();
  const addMutation = useAddStudyItem();

  // Tiny debounce without extra deps.
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  const enqueuedIds = useMemo(
    () => new Set((studyItems ?? []).map((i) => i.entry.id)),
    [studyItems],
  );

  const [errorFor, setErrorFor] = useState<Record<number, string>>({});

  const add = async (entryId: number) => {
    try {
      await addMutation.mutateAsync(entryId);
      setErrorFor((m) => {
        const n = { ...m };
        delete n[entryId];
        return n;
      });
    } catch (e) {
      const msg =
        e instanceof ApiError && e.status === 409
          ? "Já está na fila"
          : e instanceof Error
            ? e.message
            : String(e);
      setErrorFor((m) => ({ ...m, [entryId]: msg }));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Adicionar itens de estudo</h1>
        <p className="mt-1 text-sm text-slate-400">
          Busque no dicionário por hanzi ou pinyin e adicione à sua fila.
        </p>
      </div>

      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="你好, ni3hao3, hello…"
        className="w-full rounded-lg border border-white/10 bg-slate-900 px-4 py-3 text-lg text-slate-100 outline-none focus:border-accent-500"
      />

      {isFetching && <p className="text-sm text-slate-500">Buscando…</p>}

      <ul className="divide-y divide-white/5">
        {(results ?? []).map((entry) => {
          const enqueued = enqueuedIds.has(entry.id);
          return (
            <li key={entry.id} className="flex items-center gap-4 py-3">
              <Hanzi
                text={entry.simplified}
                singleCharPx={30}
                boxPx={170}
                className="shrink-0 text-slate-100"
              />
              <div className="min-w-0">
                <Pinyin value={entry.pinyin} className="text-sm" />
                <p className="truncate text-sm text-slate-400">
                  {entry.definitions.join("; ")}
                </p>
                {errorFor[entry.id] && (
                  <p className="text-xs text-rose-400">{errorFor[entry.id]}</p>
                )}
              </div>
              <button
                disabled={enqueued || addMutation.isPending}
                onClick={() => add(entry.id)}
                className={`ml-auto shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  enqueued
                    ? "bg-slate-800 text-slate-500"
                    : "bg-accent-500 text-white hover:bg-accent-600 disabled:opacity-50"
                }`}
              >
                {enqueued ? "Na fila" : "Adicionar"}
              </button>
            </li>
          );
        })}
      </ul>

      {debounced && !isFetching && (results?.length ?? 0) === 0 && (
        <p className="text-sm text-slate-500">Nenhum resultado para “{debounced}”.</p>
      )}
    </div>
  );
}
