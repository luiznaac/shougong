import type { StudyItem } from "../api/types.ts";

/**
 * Next-7-days review forecast, HanziHero-style: one bar per day for how many
 * items come due that day, plus a cumulative line showing the running backlog
 * if you did no reviews.
 */
export function ReviewForecast({ items }: { items: StudyItem[] }) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const DAYS = 7;

  const daily = Array.from({ length: DAYS }, () => 0);
  let overdue = 0;

  for (const it of items) {
    const due = new Date(it.card.due);
    if (due.getTime() <= now.getTime()) {
      overdue += 1;
      continue;
    }
    const dayIdx = Math.floor(
      (due.getTime() - startOfToday.getTime()) / 86_400_000,
    );
    if (dayIdx >= 0 && dayIdx < DAYS) daily[dayIdx] += 1;
  }

  // Columns: "agora" (overdue) + one per day. Cumulative includes the overdue pile.
  const columns = [
    { label: "agora", count: overdue, highlight: true },
    ...daily.map((count, i) => {
      const d = new Date(startOfToday.getTime() + i * 86_400_000);
      return {
        label:
          i === 0
            ? "hoje"
            : d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""),
        count,
        highlight: false,
      };
    }),
  ];

  let running = 0;
  const cumulative = columns.map((c) => (running += c.count));
  const maxBar = Math.max(1, ...columns.map((c) => c.count));
  const maxCum = Math.max(1, ...cumulative);
  const total = running;

  const H = 120; // chart height in px

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between text-sm">
        <span className="text-slate-400">Próximos 7 dias</span>
        <span className="text-slate-300">
          <span className="font-semibold tabular-nums text-slate-100">{total}</span> reviews
        </span>
      </div>

      <div className="relative" style={{ height: H }}>
        {/* cumulative line */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          preserveAspectRatio="none"
          viewBox={`0 0 ${columns.length} 100`}
        >
          <polyline
            fill="none"
            stroke="var(--color-accent-500)"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
            points={cumulative
              .map((v, i) => `${i + 0.5},${100 - (v / maxCum) * 100}`)
              .join(" ")}
          />
        </svg>

        {/* bars */}
        <div className="absolute inset-0 flex items-end gap-1.5">
          {columns.map((c, i) => (
            <div key={i} className="flex flex-1 flex-col items-center justify-end">
              {c.count > 0 && (
                <span className="mb-0.5 text-[10px] leading-none text-slate-500 tabular-nums">
                  {c.count}
                </span>
              )}
              <div
                className={`w-full rounded-sm ${c.highlight ? "bg-accent-500" : "bg-slate-600"}`}
                style={{
                  height: `${(c.count / maxBar) * (H - 24)}px`,
                  minHeight: c.count ? 3 : 0,
                }}
                title={`${c.label}: ${c.count} (acumulado ${cumulative[i]})`}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-1.5 flex gap-1.5">
        {columns.map((c, i) => (
          <span
            key={i}
            className="flex-1 text-center text-[10px] capitalize leading-none text-slate-500"
          >
            {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}
