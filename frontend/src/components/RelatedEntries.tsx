import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useAddStudyItem, useDictionarySearch, useStudyItems } from "../api/queries.ts";
import type { DictionaryEntry } from "../api/types.ts";
import { Pinyin } from "./Pinyin.tsx";
import { Hanzi } from "./Hanzi.tsx";

/**
 * Dictionary entries that come up when searching for this item's hanzi —
 * i.e. words/characters that contain it. Ones already being studied link to
 * their page; the rest can be added to the queue inline.
 */
export function RelatedEntries({
  query,
  excludeEntryId,
}: {
  query: string;
  excludeEntryId: number;
}) {
  const { data: results, isLoading, error } = useDictionarySearch(query, 25);
  const { data: studyItems } = useStudyItems();
  const addMutation = useAddStudyItem();

  const studyItemByEntry = useMemo(() => {
    const m = new Map<number, number>();
    for (const it of studyItems ?? []) m.set(it.entry.id, it.id);
    return m;
  }, [studyItems]);

  // Drop the item itself and any other entry for the exact same hanzi
  // (alternate readings/notes) — "related" means other words.
  const related = (results ?? []).filter(
    (e) => e.id !== excludeEntryId && e.simplified !== query,
  );

  if (isLoading) return <p className="text-sm text-slate-500">Carregando…</p>;
  if (error)
    return <p className="text-sm text-rose-400">Falha ao buscar relacionados.</p>;
  if (related.length === 0)
    return <p className="text-sm text-slate-500">Nenhum item relacionado.</p>;

  return (
    <ul className="divide-y divide-white/5">
      {related.map((entry) => (
        <Row
          key={entry.id}
          entry={entry}
          studyItemId={studyItemByEntry.get(entry.id)}
          onAdd={() => addMutation.mutate(entry.id)}
          adding={addMutation.isPending}
        />
      ))}
    </ul>
  );
}

function Row({
  entry,
  studyItemId,
  onAdd,
  adding,
}: {
  entry: DictionaryEntry;
  studyItemId?: number;
  onAdd: () => void;
  adding: boolean;
}) {
  const body = (
    <>
      <Hanzi
        text={entry.simplified}
        singleCharPx={28}
        boxPx={150}
        className="shrink-0 text-slate-100"
      />
      <div className="min-w-0 flex-1">
        <Pinyin value={entry.pinyin} className="text-sm" />
        <p className="truncate text-sm text-slate-400">{entry.definitions.join("; ")}</p>
      </div>
    </>
  );

  if (studyItemId != null) {
    return (
      <li>
        <Link
          to={`/items/${studyItemId}`}
          className="flex items-center gap-4 py-3 transition-colors hover:bg-white/5"
        >
          {body}
          <span className="ml-auto shrink-0 rounded-md bg-slate-800 px-3 py-1.5 text-xs text-slate-400">
            na fila
          </span>
        </Link>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-4 py-3">
      {body}
      <AddButton onAdd={onAdd} adding={adding} />
    </li>
  );
}

function AddButton({ onAdd, adding }: { onAdd: () => void; adding: boolean }) {
  return (
    <button
      onClick={onAdd}
      disabled={adding}
      className="ml-auto shrink-0 rounded-md bg-accent-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-accent-600 disabled:opacity-50"
    >
      Adicionar
    </button>
  );
}
