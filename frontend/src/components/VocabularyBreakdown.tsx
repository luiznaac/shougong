import type { VocabularySummary } from "../api/types.ts";
import { categoryRows } from "../lib/progress.ts";
import { EmptyState } from "./EmptyState.tsx";
import { ProgressBar } from "./ProgressBar.tsx";

/**
 * Perfil de vocabulário: how many queued words the dictionary places, and the
 * grammatical classes they fill, greatest first. The class bars are proportional
 * to the largest class so the shape reads at a glance.
 */
export function VocabularyBreakdown({ summary }: { summary: VocabularySummary }) {
  if (summary.total === 0) {
    return (
      <EmptyState
        icon="book"
        title="Nenhuma palavra no vocabulário ainda"
        description="Adicione palavras na Biblioteca para ver o perfil do seu vocabulário."
      />
    );
  }

  const rows = categoryRows(summary.by_category);
  const max = Math.max(1, ...rows.map((row) => row.count));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
        <span className="text-2xl font-semibold tabular-nums text-white">
          {summary.total} <span className="text-sm font-normal text-slate-400">palavras</span>
        </span>
        <span className="text-xs text-slate-500">{summary.categorised} no HSK</span>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">
          Nenhuma classe gramatical identificada nas suas palavras ainda.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((row) => (
            <li
              key={row.category}
              className="grid grid-cols-[7rem_minmax(0,1fr)_2rem] items-center gap-2"
            >
              <span className="truncate text-xs text-slate-400">{row.label}</span>
              <ProgressBar value={row.count / max} className="bg-sky-500/70" />
              <span className="text-right text-xs tabular-nums text-slate-300">{row.count}</span>
            </li>
          ))}
        </ul>
      )}

      {summary.qualifier_shortage ? (
        <p className="rounded-lg bg-amber-400/10 px-3 py-2 text-xs text-amber-400">
          Poucos qualificadores no seu vocabulário — vale estudar mais adjetivos.
        </p>
      ) : null}
    </div>
  );
}
