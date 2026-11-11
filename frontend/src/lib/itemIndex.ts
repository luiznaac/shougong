import type { SrsState, StudyItemListQuery, StudyItemSort } from "../api/types.ts";
import { type Day, dayEndInstant, dayStartInstant } from "./extraStudy.ts";
import { type ItemPageRequest, pageOffset } from "./pagination.ts";

// Biblioteca's item index keeps all of its view state in the URL: filters,
// sort, the desktop page and the mobile "shown" count. Opening an item and
// returning therefore restores the exact list position, and a shared link
// carries the same view.

/** Both presentations read 24 rows per server page; the server caps at 100. */
export const ITEM_PAGE_SIZE = 24;

export const SRS_STATES: SrsState[] = ["learning", "review", "relearning"];

export const HSK_LEVELS: (number | "none")[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, "none"];

export const ITEM_SORTS: StudyItemSort[] = ["due_asc", "created_desc", "stability_asc"];

export interface ItemIndexState {
  states: SrsState[];
  hskLevels: (number | "none")[];
  posTags: string[];
  search: string;
  /** The range is typed as local calendar days and sent as local-midnight instants. */
  dueFrom?: Day;
  dueTo?: Day;
  sort: StudyItemSort;
  /** Desktop's 1-based page. */
  page: number;
  /** Mobile's cumulative row count — always a multiple of ITEM_PAGE_SIZE. */
  shown: number;
}

export const DEFAULT_ITEM_INDEX: ItemIndexState = {
  states: [],
  hskLevels: [],
  posTags: [],
  search: "",
  sort: "due_asc",
  page: 1,
  shown: ITEM_PAGE_SIZE,
};

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function isSrsState(value: string): value is SrsState {
  return (SRS_STATES as string[]).includes(value);
}

function isHskLevel(value: string): value is `${number}` | "none" {
  if (value === "none") return true;
  const level = Number(value);
  return Number.isInteger(level) && level >= 1 && level <= 9;
}

function isSort(value: string): value is StudyItemSort {
  return (ITEM_SORTS as string[]).includes(value);
}

function isDay(value: string | null): value is Day {
  return value !== null && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function positiveInt(value: string | null, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : fallback;
}

/** A mobile "shown" count is a whole number of 24-row pages, never below one. */
function shownCount(value: string | null): number {
  const n = positiveInt(value, 1);
  return Math.max(1, Math.floor(n / ITEM_PAGE_SIZE)) * ITEM_PAGE_SIZE;
}

export function parseItemIndex(search: URLSearchParams): ItemIndexState {
  const states = unique(search.getAll("state").filter(isSrsState));
  const hskLevels = unique(
    search
      .getAll("hsk_level")
      .filter(isHskLevel)
      .map((value) => (value === "none" ? "none" : Number(value))),
  );
  const sort = search.get("sort");

  return {
    states,
    hskLevels,
    posTags: unique(search.getAll("pos_tag").filter(Boolean)),
    search: (search.get("search") ?? "").trim(),
    dueFrom: isDay(search.get("due_from")) ? (search.get("due_from") as Day) : undefined,
    dueTo: isDay(search.get("due_to")) ? (search.get("due_to") as Day) : undefined,
    sort: sort !== null && isSort(sort) ? sort : DEFAULT_ITEM_INDEX.sort,
    page: positiveInt(search.get("page"), DEFAULT_ITEM_INDEX.page),
    shown: shownCount(search.get("shown")),
  };
}

export function serializeItemIndex(state: ItemIndexState): URLSearchParams {
  const params = new URLSearchParams();
  for (const value of state.states) params.append("state", value);
  for (const value of state.hskLevels) params.append("hsk_level", String(value));
  for (const value of state.posTags) params.append("pos_tag", value);
  if (state.search) params.set("search", state.search);
  if (state.dueFrom) params.set("due_from", state.dueFrom);
  if (state.dueTo) params.set("due_to", state.dueTo);
  if (state.sort !== DEFAULT_ITEM_INDEX.sort) params.set("sort", state.sort);
  if (state.page !== DEFAULT_ITEM_INDEX.page) params.set("page", String(state.page));
  if (state.shown !== DEFAULT_ITEM_INDEX.shown) params.set("shown", String(state.shown));
  return params;
}

export function toggleValue<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
}

/** True when at least one narrowing filter is set; the sort is not a filter. */
export function hasFilters(state: ItemIndexState): boolean {
  return (
    state.states.length > 0 ||
    state.hskLevels.length > 0 ||
    state.posTags.length > 0 ||
    state.search.length > 0 ||
    Boolean(state.dueFrom) ||
    Boolean(state.dueTo)
  );
}

export interface DueRangeInstants {
  due_from?: string;
  due_to?: string;
}

/** The due range as instants: `from` is inclusive, `to` is the next local midnight. */
export function dueRangeInstants(
  state: Pick<ItemIndexState, "dueFrom" | "dueTo">,
): DueRangeInstants {
  return {
    due_from: state.dueFrom ? dayStartInstant(state.dueFrom) : undefined,
    due_to: state.dueTo ? dayEndInstant(state.dueTo) : undefined,
  };
}

/** Keep the typed due range ordered: a crossing endpoint clears the other one. */
export function dueRangePatch(
  range: Pick<ItemIndexState, "dueFrom" | "dueTo">,
  endpoint: "dueFrom" | "dueTo",
  value: Day | undefined,
): Pick<ItemIndexState, "dueFrom" | "dueTo"> {
  if (endpoint === "dueFrom") {
    return {
      dueFrom: value,
      dueTo: value && range.dueTo && value > range.dueTo ? undefined : range.dueTo,
    };
  }
  return {
    dueTo: value,
    dueFrom: value && range.dueFrom && value < range.dueFrom ? undefined : range.dueFrom,
  };
}

export function itemIndexQuery(state: ItemIndexState): StudyItemListQuery {
  const { due_from, due_to } = dueRangeInstants(state);
  return {
    state: state.states.length ? state.states : undefined,
    hsk_level: state.hskLevels.length ? state.hskLevels : undefined,
    pos_tag: state.posTags.length ? state.posTags : undefined,
    search: state.search || undefined,
    due_from,
    due_to,
    sort: state.sort,
  };
}

/** The server page requests behind a presentation. Desktop reads one page;
 * mobile reads every 24-row page it has shown so far, never more than the cap. */
export function itemIndexRequests(
  state: ItemIndexState,
  presentation: "desktop" | "mobile",
): ItemPageRequest[] {
  if (presentation === "desktop") {
    return [{ limit: ITEM_PAGE_SIZE, offset: pageOffset(state.page, ITEM_PAGE_SIZE) }];
  }
  const pages = Math.max(1, Math.ceil(state.shown / ITEM_PAGE_SIZE));
  return Array.from({ length: pages }, (_, index) => ({
    limit: ITEM_PAGE_SIZE,
    offset: index * ITEM_PAGE_SIZE,
  }));
}
