import { describe, expect, it } from "vitest";
import { addDays, defaultRange, parsePracticeSearch, rangeInstants, toDay } from "./extraStudy.ts";

const now = new Date(2026, 9, 30, 15, 30); // 2026-10-30, local time

describe("extra-study range", () => {
  it("defaults to the last three inclusive local days", () => {
    expect(defaultRange(now)).toEqual({ from: "2026-10-28", to: "2026-10-30" });
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
