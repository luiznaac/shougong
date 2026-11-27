import type { DictionaryEntry } from "../api/types.ts";

function Spinner() {
  return (
    <span className="inline-block h-2.5 w-2.5 animate-spin rounded-full border-2 border-sky-300 border-t-transparent" />
  );
}

/**
 * The inline picker for an ambiguous dictionary match: one button per candidate
 * entry, disabled while the chosen one is being added. Both the CSV import and
 * the HanziHero sync resolve a row through the same single-item endpoint, so the
 * picker is shared rather than reimplemented per panel.
 */
export function CandidatePicker({
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
      {detail ? <p className="text-xs text-slate-500">{detail}</p> : null}
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
