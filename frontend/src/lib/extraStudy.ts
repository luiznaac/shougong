// Extra Study is selected by the learner's local calendar days; the backend
// only ever sees instants. All local-midnight arithmetic lives here.

export type Day = string; // YYYY-MM-DD in the browser's local calendar

export const EXTRA_STUDY_BUCKETS = ["recent_mistakes", "recently_learned"] as const;

export type ExtraStudyBucket = (typeof EXTRA_STUDY_BUCKETS)[number];

export function isExtraStudyBucket(value: string | null): value is ExtraStudyBucket {
  return value === "recent_mistakes" || value === "recently_learned";
}

export interface ExtraStudyRange {
  from: Day;
  to: Day;
}

export interface RangeBounds {
  min: Day;
  max: Day;
}

const DEFAULT_RANGE_DAYS = 3;
const SELECTABLE_RANGE_DAYS = 30;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function toDay(date: Date): Day {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseDay(day: Day): Date {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(year, month - 1, date);
}

export function addDays(day: Day, days: number): Day {
  const date = parseDay(day);
  date.setDate(date.getDate() + days);
  return toDay(date);
}

export function rangeBounds(now: Date = new Date()): RangeBounds {
  const today = toDay(now);
  return { min: addDays(today, -(SELECTABLE_RANGE_DAYS - 1)), max: today };
}

export function defaultRange(now: Date = new Date()): ExtraStudyRange {
  const today = toDay(now);
  return { from: addDays(today, -(DEFAULT_RANGE_DAYS - 1)), to: today };
}

export function clampDay(day: Day, bounds: RangeBounds): Day {
  if (day < bounds.min) return bounds.min;
  if (day > bounds.max) return bounds.max;
  return day;
}

/** Clamp the edited endpoint to the bounds, then keep `from <= to`. */
export function clampRangeEndpoint(
  range: ExtraStudyRange,
  endpoint: "from" | "to",
  day: Day,
  bounds: RangeBounds,
): ExtraStudyRange {
  const clamped = clampDay(day, bounds);
  if (endpoint === "from") {
    return { from: clamped > range.to ? range.to : clamped, to: range.to };
  }
  return { from: range.from, to: clamped < range.from ? range.from : clamped };
}

export function rangeInstants(range: ExtraStudyRange): { from: string; to: string } {
  const start = parseDay(range.from);
  const end = parseDay(range.to);
  end.setDate(end.getDate() + 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

export interface PracticeSearch {
  bucket: ExtraStudyBucket;
  from: string;
  to: string;
}

export function parsePracticeSearch(search: URLSearchParams): PracticeSearch | null {
  const bucket = search.get("bucket");
  const from = search.get("from");
  const to = search.get("to");
  if (!isExtraStudyBucket(bucket)) return null;
  if (!from || !to) return null;
  return { bucket, from, to };
}
