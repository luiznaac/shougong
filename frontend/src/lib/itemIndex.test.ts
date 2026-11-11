import { describe, expect, it } from "vitest";
import {
  DEFAULT_ITEM_INDEX,
  dueRangeInstants,
  dueRangePatch,
  hasFilters,
  itemIndexQuery,
  itemIndexRequests,
  parseItemIndex,
  serializeItemIndex,
  toggleValue,
} from "./itemIndex.ts";

describe("item index URL state", () => {
  it("parses every filter, the sort and both presentation positions", () => {
    const state = parseItemIndex(
      new URLSearchParams({
        state: "review",
        hsk_level: "2",
        pos_tag: "v",
        search: " xue ",
        due_from: "2026-10-01",
        due_to: "2026-10-30",
        sort: "created_desc",
        page: "3",
        shown: "72",
      }),
    );

    expect(state).toEqual({
      states: ["review"],
      hskLevels: [2],
      posTags: ["v"],
      search: "xue",
      dueFrom: "2026-10-01",
      dueTo: "2026-10-30",
      sort: "created_desc",
      page: 3,
      shown: 72,
    });
  });

  it("falls back to the defaults on an empty query", () => {
    expect(parseItemIndex(new URLSearchParams())).toEqual(DEFAULT_ITEM_INDEX);
  });

  it("drops unknown or malformed values instead of trusting the URL", () => {
    const state = parseItemIndex(
      new URLSearchParams({
        state: "burned",
        hsk_level: "12",
        sort: "newest",
        page: "0",
        shown: "25",
      }),
    );

    expect(state.states).toEqual([]);
    expect(state.hskLevels).toEqual([]);
    expect(state.sort).toBe("due_asc");
    expect(state.page).toBe(1);
    expect(state.shown).toBe(24);
  });

  it("keeps repeated values, deduplicated, and understands the none HSK bucket", () => {
    const params = new URLSearchParams();
    for (const value of ["learning", "learning", "relearning"]) params.append("state", value);
    for (const value of ["1", "9", "none"]) params.append("hsk_level", value);

    const state = parseItemIndex(params);

    expect(state.states).toEqual(["learning", "relearning"]);
    expect(state.hskLevels).toEqual([1, 9, "none"]);
  });

  it("round-trips a non-default state through the URL", () => {
    const state = {
      ...DEFAULT_ITEM_INDEX,
      states: ["learning" as const],
      hskLevels: [3 as const, "none" as const],
      posTags: ["n", "v"],
      search: "xue",
      dueFrom: "2026-10-01",
      dueTo: "2026-12-31",
      sort: "stability_asc" as const,
      page: 4,
      shown: 96,
    };

    expect(parseItemIndex(serializeItemIndex(state))).toEqual(state);
  });

  it("omits defaults from the URL and lists repeated values", () => {
    const params = serializeItemIndex({
      ...DEFAULT_ITEM_INDEX,
      states: ["learning", "review"],
      posTags: ["v"],
    });

    expect(params.get("sort")).toBeNull();
    expect(params.get("page")).toBeNull();
    expect(params.get("shown")).toBeNull();
    expect(params.getAll("state")).toEqual(["learning", "review"]);
    expect(params.getAll("pos_tag")).toEqual(["v"]);
  });

  it("toggles a value in and out of a multi-select", () => {
    expect(toggleValue(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleValue(["a", "b"], "a")).toEqual(["b"]);
  });

  it("knows when any filter is active", () => {
    expect(hasFilters(DEFAULT_ITEM_INDEX)).toBe(false);
    expect(hasFilters({ ...DEFAULT_ITEM_INDEX, search: "xue" })).toBe(true);
    expect(hasFilters({ ...DEFAULT_ITEM_INDEX, dueFrom: "2026-10-01" })).toBe(true);
    expect(hasFilters({ ...DEFAULT_ITEM_INDEX, sort: "created_desc" })).toBe(false);
  });
});

describe("item index request mapping", () => {
  it("maps the filters and the sort onto the API query", () => {
    const query = itemIndexQuery({
      ...DEFAULT_ITEM_INDEX,
      states: ["review"],
      hskLevels: [2, "none"],
      posTags: ["v"],
      search: "xue",
      sort: "created_desc",
    });

    expect(query).toEqual({
      state: ["review"],
      hsk_level: [2, "none"],
      pos_tag: ["v"],
      search: "xue",
      due_from: undefined,
      due_to: undefined,
      sort: "created_desc",
    });
  });

  it("sends local midnights for a fully or partially set due range", () => {
    expect(dueRangeInstants({ dueFrom: "2026-10-01", dueTo: "2026-10-30" })).toEqual({
      due_from: new Date(2026, 9, 1).toISOString(),
      due_to: new Date(2026, 9, 31).toISOString(),
    });
    expect(dueRangeInstants({ dueFrom: "2026-10-01" })).toEqual({
      due_from: new Date(2026, 9, 1).toISOString(),
      due_to: undefined,
    });
    expect(dueRangeInstants({ dueTo: "2026-10-30" })).toEqual({
      due_from: undefined,
      due_to: new Date(2026, 9, 31).toISOString(),
    });
  });

  it("keeps the typed due range ordered, clearing the endpoint it crosses", () => {
    const range = { dueFrom: "2026-10-01", dueTo: "2026-10-30" };

    expect(dueRangePatch(range, "dueFrom", "2026-11-15")).toEqual({
      dueFrom: "2026-11-15",
      dueTo: undefined,
    });
    expect(dueRangePatch(range, "dueTo", "2026-09-01")).toEqual({
      dueTo: "2026-09-01",
      dueFrom: undefined,
    });
    expect(dueRangePatch(range, "dueTo", "2026-11-15")).toEqual({
      dueTo: "2026-11-15",
      dueFrom: "2026-10-01",
    });
    expect(dueRangePatch({}, "dueFrom", undefined)).toEqual({
      dueFrom: undefined,
      dueTo: undefined,
    });
  });

  it("derives one server page for desktop and every shown page for mobile", () => {
    const state = { ...DEFAULT_ITEM_INDEX, page: 3, shown: 72 };

    expect(itemIndexRequests(state, "desktop")).toEqual([{ limit: 24, offset: 48 }]);
    expect(itemIndexRequests(state, "mobile")).toEqual([
      { limit: 24, offset: 0 },
      { limit: 24, offset: 24 },
      { limit: 24, offset: 48 },
    ]);
  });
});
