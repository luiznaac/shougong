import type { StudyItem } from "../api/types.ts";

/**
 * HanziHero-style "Upcoming Reviews": one row per upcoming day (starting
 * tomorrow — today and overdue items are shown by the Reviews button), each with
 * a proportional bar and a "+N" count.
 */
export function UpcomingReviews({ items, days = 7 }: { items: StudyItem[]; days?: number }) {
  const now = new Date();
  const startOfTomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  );

  const rows = Array.from({ length: days }, (_, i) => {
    const dayStart = new Date(startOfTomorrow.getTime() + i * 86_400_000);
    const dayEnd = new Date(dayStart.getTime() + 86_400_000);
    const count = items.filter((it) => {
      const t = new Date(it.card.due).getTime();
      return t >= dayStart.getTime() && t < dayEnd.getTime();
    }).length;
    return {
      label: dayStart.toLocaleDateString("pt-BR", { weekday: "long" }),
      count,
    };
  });

  const max = Math.max(1, ...rows.map((r) => r.count));
  const total = rows.reduce((n, r) => n + r.count, 0);

  return (
    <div>
      {rows.map((r, i) => (
        <div
          key={i}
          className="my-2 grid grid-cols-12 items-center gap-2 text-sm text-slate-300"
        >
          <span className="col-span-3 truncate capitalize text-slate-400">{r.label}</span>
          <div className="col-span-7 h-2.5 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-accent-500"
              style={{ width: `${(r.count / max) * 100}%` }}
            />
          </div>
          <span className="col-span-2 text-right tabular-nums">
            <span className="text-slate-500">+</span>
            {r.count}
          </span>
        </div>
      ))}
      <p className="mt-3 text-right text-xs text-slate-500">
        {total} reviews nos próximos {days} dias
      </p>
    </div>
  );
}
