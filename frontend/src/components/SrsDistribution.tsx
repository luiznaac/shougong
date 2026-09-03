import { GROUP_COLOR, GROUP_LABEL, GROUP_ORDER, type SrsGroup } from "../lib/srs.ts";

/** HanziHero-style "SRS Stage Distribution": horizontal bar per group. */
export function SrsDistribution({ tally }: { tally: Record<SrsGroup, number> }) {
  const max = Math.max(1, ...GROUP_ORDER.map((g) => tally[g]));
  const total = GROUP_ORDER.reduce((n, g) => n + tally[g], 0);

  return (
    <div className="space-y-2.5">
      {GROUP_ORDER.map((g) => (
        <div key={g} className="grid grid-cols-12 items-center gap-2 text-sm">
          <span className="col-span-3 text-slate-400">{GROUP_LABEL[g]}</span>
          <div className="col-span-8 h-4 overflow-hidden rounded bg-slate-800">
            <div
              className="h-full rounded"
              style={{ width: `${(tally[g] / max) * 100}%`, background: GROUP_COLOR[g] }}
            />
          </div>
          <span className="col-span-1 text-right tabular-nums text-slate-300">
            {tally[g]}
          </span>
        </div>
      ))}
      <p className="pt-1 text-right text-xs text-slate-500">{total} itens</p>
    </div>
  );
}
