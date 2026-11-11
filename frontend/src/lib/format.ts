const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

export function fromNow(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const min = 60_000;
  const hour = 60 * min;
  const day = 24 * hour;

  if (abs < hour) return rtf.format(Math.round(diffMs / min), "minute");
  if (abs < day) return rtf.format(Math.round(diffMs / hour), "hour");
  if (abs < 30 * day) return rtf.format(Math.round(diffMs / day), "day");
  return rtf.format(Math.round(diffMs / (30 * day)), "month");
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { dateStyle: "medium" });
}

// Local calendar days arrive as `YYYY-MM-DD` from the overview aggregate. Parsing
// them with `new Date(day)` would read them as UTC midnight and shift a day in
// any negative-offset timezone, so the local parts are read explicitly.
export function parseLocalDay(day: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date);
}

/** `12 de nov.` — for axis ticks and row titles on local-day data. */
export function formatDayLabel(day: string): string {
  return parseLocalDay(day).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

/** `qui.` — the compact local weekday for a forecast row. */
export function formatWeekdayLabel(day: string): string {
  return parseLocalDay(day).toLocaleDateString("pt-BR", { weekday: "short" });
}
