import type { HskCoverageRow } from "../lib/progress.ts";
import { EmptyState } from "./EmptyState.tsx";
import { ProgressBar } from "./ProgressBar.tsx";

/**
 * Cobertura HSK: one quiet proportional bar per level, from the vocabulary
 * aggregate's per-level coverage joined with the queued word counts. With no HSK
 * totals in the dictionary it says so rather than drawing empty bars.
 */
export function HskCoverage({ rows }: { rows: HskCoverageRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon="chart"
        title="Cobertura HSK indisponível"
        description="A cobertura por nível aparece quando o dicionário traz os níveis HSK."
      />
    );
  }

  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.level}>
          <div className="mb-1 flex items-baseline justify-between text-xs">
            <span className="text-slate-400">HSK {row.level}</span>
            <span className="tabular-nums text-slate-300">
              {Math.round(row.coverage * 100)}%{" "}
              <span className="text-slate-600">({row.known})</span>
            </span>
          </div>
          <ProgressBar value={row.coverage} />
        </li>
      ))}
    </ul>
  );
}
