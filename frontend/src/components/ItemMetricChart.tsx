import { useMemo } from "react";
import type { StudyItemHistory } from "../api/types.ts";

const W = 480;
const H = 200;
const PAD = { top: 14, right: 12, bottom: 24, left: 12 };
const PW = W - PAD.left - PAD.right;
const PH = H - PAD.top - PAD.bottom;

const STABILITY_COLOR = "var(--color-accent-500)";
const DIFFICULTY_COLOR = "#0ea5e9";
const DIFFICULTY_MAX = 10; // FSRS difficulty is on a 1–10 scale

/**
 * HanziHero-style progress chart: stability and difficulty over time, overlaid
 * on independent scales. `history` comes newest-first from
 * GET /study-items/{id}/history.
 */
export function ItemMetricChart({ history }: { history: StudyItemHistory[] }) {
  const model = useMemo(() => {
    const rows = [...history]
      .map((h) => ({
        t: new Date(h.created_at).getTime(),
        stability: h.card.stability,
        difficulty: h.card.difficulty,
      }))
      .sort((a, b) => a.t - b.t);

    if (rows.length === 0) return null;

    const t0 = rows[0].t;
    const t1 = rows[rows.length - 1].t;
    const span = Math.max(1, t1 - t0);
    const maxStability = Math.max(
      1,
      ...rows.map((r) => r.stability ?? 0),
    );

    const x = (t: number) => PAD.left + ((t - t0) / span) * PW;
    const yStab = (v: number) => PAD.top + PH - (v / maxStability) * PH;
    const yDiff = (v: number) => PAD.top + PH - (v / DIFFICULTY_MAX) * PH;

    const line = (pick: (r: (typeof rows)[number]) => number | null, y: (v: number) => number) =>
      rows
        .filter((r) => pick(r) != null)
        .map((r) => `${x(r.t).toFixed(1)},${y(pick(r) as number).toFixed(1)}`)
        .join(" ");

    const stabilityLine = line((r) => r.stability, yStab);
    const stabilityArea =
      stabilityLine &&
      `${PAD.left},${PAD.top + PH} ${stabilityLine} ${PAD.left + PW},${PAD.top + PH}`;

    return {
      rows,
      stabilityLine,
      stabilityArea,
      difficultyLine: line((r) => r.difficulty, yDiff),
      maxStability,
      first: new Date(t0),
      last: new Date(t1),
      single: rows.length === 1,
      lastPoint: {
        x: x(t1),
        stab: rows[rows.length - 1].stability != null ? yStab(rows[rows.length - 1].stability as number) : null,
        diff: rows[rows.length - 1].difficulty != null ? yDiff(rows[rows.length - 1].difficulty as number) : null,
      },
    };
  }, [history]);

  if (!model) return <p className="text-sm text-slate-500">Sem histórico ainda.</p>;

  const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
        <Legend color={STABILITY_COLOR} label={`Estabilidade (0–${model.maxStability.toFixed(0)} d)`} />
        <Legend color={DIFFICULTY_COLOR} label={`Dificuldade (0–${DIFFICULTY_MAX})`} />
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={PAD.left}
            x2={PAD.left + PW}
            y1={PAD.top + PH * f}
            y2={PAD.top + PH * f}
            stroke="currentColor"
            className="text-white/5"
          />
        ))}

        {model.stabilityArea && (
          <polygon points={model.stabilityArea} fill={STABILITY_COLOR} fillOpacity="0.12" />
        )}
        {model.stabilityLine && (
          <polyline
            points={model.stabilityLine}
            fill="none"
            stroke={STABILITY_COLOR}
            strokeWidth="2"
          />
        )}
        {model.difficultyLine && (
          <polyline
            points={model.difficultyLine}
            fill="none"
            stroke={DIFFICULTY_COLOR}
            strokeWidth="2"
            strokeDasharray="4 3"
          />
        )}

        {model.single && (
          <>
            {model.lastPoint.stab != null && (
              <circle cx={model.lastPoint.x} cy={model.lastPoint.stab} r="3.5" fill={STABILITY_COLOR} />
            )}
            {model.lastPoint.diff != null && (
              <circle cx={model.lastPoint.x} cy={model.lastPoint.diff} r="3.5" fill={DIFFICULTY_COLOR} />
            )}
          </>
        )}

        <text x={PAD.left} y={H - 8} className="fill-slate-500 text-[10px]">
          {fmt(model.first)}
        </text>
        <text x={PAD.left + PW} y={H - 8} textAnchor="end" className="fill-slate-500 text-[10px]">
          {fmt(model.last)}
        </text>
      </svg>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-slate-400">
      <span className="h-2 w-4 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
