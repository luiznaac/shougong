import { useMemo } from "react";
import type { StudyItem } from "../api/types.ts";

/**
 * Cumulative count of study items added over time, from `created_at`.
 * (The backend records when an item was enqueued, not when it was "learned".)
 */
export function ItemsAddedChart({ items }: { items: StudyItem[] }) {
  const { points, total, firstLabel, lastLabel } = useMemo(() => {
    if (items.length === 0)
      return { points: "", total: 0, firstLabel: "", lastLabel: "" };

    const dates = items
      .map((i) => new Date(i.created_at).getTime())
      .sort((a, b) => a - b);
    const start = startOfDay(dates[0]);
    const end = startOfDay(Date.now());
    const dayMs = 86_400_000;
    const spanDays = Math.max(1, Math.round((end - start) / dayMs));

    const daily = new Array(spanDays + 1).fill(0);
    for (const t of dates) {
      const idx = Math.min(spanDays, Math.round((startOfDay(t) - start) / dayMs));
      daily[idx] += 1;
    }
    let run = 0;
    const cum = daily.map((d) => (run += d));
    const maxY = run;

    const pts = cum
      .map((y, i) => `${(i / spanDays) * 100},${100 - (y / maxY) * 100}`)
      .join(" ");

    return {
      points: pts,
      total: run,
      firstLabel: new Date(start).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
      lastLabel: new Date(end).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
    };
  }, [items]);

  if (items.length === 0)
    return <p className="text-sm text-slate-500">Nenhum item ainda.</p>;

  return (
    <div>
      <div className="mb-2 text-sm text-slate-300">
        <span className="font-semibold tabular-nums text-slate-100">{total}</span> itens no total
      </div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-32 w-full">
        <polygon
          points={`0,100 ${points} 100,100`}
          fill="var(--color-accent-500)"
          fillOpacity="0.15"
        />
        <polyline
          points={points}
          fill="none"
          stroke="var(--color-accent-500)"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-slate-500">
        <span>{firstLabel}</span>
        <span>{lastLabel}</span>
      </div>
    </div>
  );
}

function startOfDay(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
