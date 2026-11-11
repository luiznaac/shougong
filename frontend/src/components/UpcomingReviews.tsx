import type { DailyDue } from "../api/types.ts";
import { formatDayLabel, formatWeekdayLabel } from "../lib/format.ts";

const FORECAST_DAYS = 7;

/**
 * Próximas revisões: exactly seven local-day rows from the overview aggregate,
 * each with a quiet proportional bar and its count. Day bucketing is the
 * backend's — the client never reconstructs it from due instants.
 */
export function UpcomingReviews({ days }: { days: DailyDue[] }) {
  const rows = days.slice(0, FORECAST_DAYS);
  const max = Math.max(1, ...rows.map((day) => day.due));
  const total = rows.reduce((n, day) => n + day.due, 0);

  return (
    <div>
      <ul className="space-y-1.5">
        {rows.map((day) => (
          <li
            key={day.date}
            title={formatDayLabel(day.date)}
            className="flex items-center gap-2 text-[11px]"
          >
            <span className="w-9 capitalize text-slate-500">{formatWeekdayLabel(day.date)}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
              <span
                className="block h-full rounded-full bg-accent-500/70"
                style={{ width: `${(day.due / max) * 100}%` }}
              />
            </span>
            <span className="w-5 text-right tabular-nums text-slate-400">{day.due}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-right text-[10px] text-slate-500">
        {total} revisões nos próximos {rows.length} dias
      </p>
    </div>
  );
}
