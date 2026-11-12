import type { LearnedProgress } from "../api/types.ts";
import { formatDayLabel } from "../lib/format.ts";
import { ChartAxes } from "./ChartAxes.tsx";

/**
 * The cumulative learned series from the overview aggregate, chart-only: the plot
 * plus HTML axis labels beside and below it. Y ticks are the total, its half and
 * zero; X labels are the first and last local days of the series.
 */
export function ItemsLearnedChart({ learned }: { learned: LearnedProgress }) {
  const { points } = learned;
  if (points.length === 0) {
    return <p className="text-sm text-slate-500">Nenhum item aprendido ainda.</p>;
  }

  const max = Math.max(1, learned.total, ...points.map((point) => point.count));
  const span = Math.max(1, points.length - 1);
  const coords = points.map((point, i) => `${(i / span) * 100},${100 - (point.count / max) * 100}`);
  const ticks = Array.from(new Set([max, Math.round(max / 2), 0]));
  const single = points.length === 1;

  return (
    <ChartAxes
      leftTicks={ticks.map(String)}
      dateTicks={
        single
          ? [formatDayLabel(points[0].date)]
          : [formatDayLabel(points[0].date), formatDayLabel(points[points.length - 1].date)]
      }
      height={176}
    >
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="h-full w-full"
        role="img"
        aria-label="Itens aprendidos ao longo do tempo"
      >
        {[0, 50, 100].map((y) => (
          <line
            key={y}
            x1="0"
            x2="100"
            y1={y}
            y2={y}
            stroke="rgba(255,255,255,0.07)"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        <polygon
          points={`0,100 ${coords.join(" ")} 100,100`}
          fill="var(--color-accent-500)"
          fillOpacity="0.15"
        />
        <polyline
          points={coords.join(" ")}
          fill="none"
          stroke="var(--color-accent-500)"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1="0"
          x2="0"
          y1="0"
          y2="100"
          stroke="rgba(255,255,255,0.18)"
          vectorEffect="non-scaling-stroke"
        />
        <line
          x1="0"
          x2="100"
          y1="100"
          y2="100"
          stroke="rgba(255,255,255,0.18)"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </ChartAxes>
  );
}
