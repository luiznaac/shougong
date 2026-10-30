import { describe, expect, it } from "vitest";
import {
  addDays,
  clampDay,
  clampRangeEndpoint,
  defaultRange,
  parsePracticeSearch,
  rangeBounds,
  rangeInstants,
  toDay,
} from "./extraStudy.ts";

const now = new Date(2026, 9, 30, 15, 30); // 2026-10-30, local time

describe("extra-study range", () => {
  it("defaults to the last three inclusive local days", () => {
    expect(defaultRange(now)).toEqual({ from: "2026-10-28", to: "2026-10-30" });
  });

  it("allows today minus 29 through today", () => {
    expect(rangeBounds(now)).toEqual({ min: "2026-10-01", max: "2026-10-30" });
  });

  it("clamps a typed day to the selectable bounds", () => {
    const bounds = rangeBounds(now);
    expect(clampDay("2026-09-01", bounds)).toBe("2026-10-01");
    expect(clampDay("2027-01-01", bounds)).toBe("2026-10-30");
    expect(clampDay("2026-10-15", bounds)).toBe("2026-10-15");
  });

  it("keeps the range ordered when a typed endpoint crosses the other", () => {
    const bounds = rangeBounds(now);
    const range = { from: "2026-10-28", to: "2026-10-30" };
    expect(clampRangeEndpoint(range, "from", "2026-10-30", bounds)).toEqual({
      from: "2026-10-30",
      to: "2026-10-30",
    });
    expect(clampRangeEndpoint(range, "from", "2026-11-15", bounds)).toEqual({
      from: "2026-10-30",
      to: "2026-10-30",
    });
    expect(clampRangeEndpoint(range, "to", "2026-10-10", bounds)).toEqual({
      from: "2026-10-28",
      to: "2026-10-28",
    });
  });

  it("sends local midnights, with `to` as the next local midnight", () => {
    expect(rangeInstants({ from: "2026-10-28", to: "2026-10-30" })).toEqual({
      from: new Date(2026, 9, 28).toISOString(),
      to: new Date(2026, 9, 31).toISOString(),
    });
  });

  it("does calendar arithmetic across a month boundary", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(toDay(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("parsePracticeSearch", () => {
  it("reads the bucket and both instants from the URL", () => {
    const params = new URLSearchParams({
      bucket: "recently_learned",
      from: "2026-10-28T03:00:00.000Z",
      to: "2026-10-31T03:00:00.000Z",
    });
    expect(parsePracticeSearch(params)).toEqual({
      bucket: "recently_learned",
      from: "2026-10-28T03:00:00.000Z",
      to: "2026-10-31T03:00:00.000Z",
    });
  });

  it("rejects an unknown bucket or a missing instant", () => {
    expect(
      parsePracticeSearch(new URLSearchParams({ bucket: "leeches", from: "a", to: "b" })),
    ).toBeNull();
    expect(
      parsePracticeSearch(new URLSearchParams({ bucket: "recent_mistakes", from: "a" })),
    ).toBeNull();
  });
});
