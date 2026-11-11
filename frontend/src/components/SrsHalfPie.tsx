import { GROUP_COLOR, GROUP_LABEL, GROUP_ORDER, type SrsGroup } from "../lib/srs.ts";

const TRACK_PATH = "M 22 96 A 78 78 0 0 1 178 96";

/**
 * HanziHero-style SRS Stages half-pie: a 180° ring split by the five display
 * groups in `GROUP_COLOR` order, the total in the centre and a two-column count
 * legend underneath. At zero it renders the empty track — never a missing chart.
 */
export function SrsHalfPie({ tally }: { tally: Record<SrsGroup, number> }) {
  const total = GROUP_ORDER.reduce((n, group) => n + tally[group], 0);
  let offset = 0;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 104" className="w-40 max-w-full sm:w-56">
        <title>Distribuição dos estágios SRS</title>
        <path d={TRACK_PATH} fill="none" stroke="#1e293b" strokeWidth={30} />
        {GROUP_ORDER.map((group) => {
          const fraction = total === 0 ? 0 : tally[group] / total;
          const start = offset;
          offset += fraction;
          if (fraction === 0) return null;
          return (
            <path
              key={group}
              d={TRACK_PATH}
              pathLength={100}
              fill="none"
              stroke={GROUP_COLOR[group]}
              strokeWidth={30}
              strokeDasharray={`${fraction * 100} 100`}
              strokeDashoffset={-start * 100}
            />
          );
        })}
        <text
          x="100"
          y="70"
          textAnchor="middle"
          className="fill-slate-100"
          fontSize="26"
          fontWeight="600"
        >
          {total}
        </text>
        <text x="100" y="86" textAnchor="middle" className="fill-slate-500" fontSize="9">
          itens
        </text>
      </svg>
      <div className="mt-2 grid w-full grid-cols-2 gap-x-4 gap-y-1">
        {GROUP_ORDER.map((group) => (
          <span key={group} className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span className="h-2 w-2 rounded-full" style={{ background: GROUP_COLOR[group] }} />
            {GROUP_LABEL[group]}
            <span className="ml-auto tabular-nums text-slate-300">{tally[group]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
