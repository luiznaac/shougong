// Extra Study is selected by the learner's local calendar days; the backend
// only ever sees instants. All local-midnight arithmetic lives here.

import { parseLocalDay } from "./format.ts";

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

const DEFAULT_RANGE_DAYS = 3;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function toDay(date: Date): Day {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(day: Day, days: number): Day {
  const date = parseLocalDay(day);
  date.setDate(date.getDate() + days);
  return toDay(date);
}

export function defaultRange(now: Date = new Date()): ExtraStudyRange {
  const today = toDay(now);
  return { from: addDays(today, -(DEFAULT_RANGE_DAYS - 1)), to: today };
}

export function rangeInstants(range: ExtraStudyRange): { from: string; to: string } {
  const start = parseLocalDay(range.from);
  const end = parseLocalDay(range.to);
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
