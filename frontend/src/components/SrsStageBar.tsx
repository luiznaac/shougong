import { STAGE_COLOR, STAGE_LABEL, STAGE_ORDER, type SrsStage } from "../lib/srs.ts";

export function SrsStageBar({ tally }: { tally: Record<SrsStage, number> }) {
  const total = STAGE_ORDER.reduce((n, s) => n + tally[s], 0);

  return (
    <div className="space-y-3">
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-800">
        {total > 0 &&
          STAGE_ORDER.map((s) =>
            tally[s] > 0 ? (
              <div
                key={s}
                style={{
                  width: `${(tally[s] / total) * 100}%`,
                  background: STAGE_COLOR[s],
                }}
                title={`${STAGE_LABEL[s]}: ${tally[s]}`}
              />
            ) : null,
          )}
      </div>
      <ul className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
        {STAGE_ORDER.map((s) => (
          <li key={s} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: STAGE_COLOR[s] }}
            />
            <span className="text-slate-400">{STAGE_LABEL[s]}</span>
            <span className="ml-auto font-semibold tabular-nums text-slate-200">
              {tally[s]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
