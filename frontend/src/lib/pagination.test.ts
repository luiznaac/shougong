import { describe, expect, it } from "vitest";
import { nextPageOffset, pageCount, pageOffset, pageWindow } from "./pagination.ts";

describe("pagination arithmetic", () => {
  it("counts pages from the exact total, always at least one", () => {
    expect(pageCount(0, 24)).toBe(1);
    expect(pageCount(1, 24)).toBe(1);
    expect(pageCount(24, 24)).toBe(1);
    expect(pageCount(25, 24)).toBe(2);
    expect(pageCount(137, 24)).toBe(6);
    expect(pageCount(137, 5)).toBe(28);
  });

  it("maps a 1-based page onto its server offset", () => {
    expect(pageOffset(1, 24)).toBe(0);
    expect(pageOffset(3, 24)).toBe(48);
    expect(pageOffset(2, 8)).toBe(8);
  });

  it("lists every page when they fit", () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(3, 6)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("windows a long list around the current page, keeping the ends", () => {
    expect(pageWindow(1, 20)).toEqual([1, 2, 3, null, 20]);
    expect(pageWindow(10, 20)).toEqual([1, null, 8, 9, 10, 11, 12, null, 20]);
    expect(pageWindow(20, 20)).toEqual([1, null, 18, 19, 20]);
  });

  it("derives the next infinite-page offset from the envelope's exact total", () => {
    expect(nextPageOffset({ items: [1, 2, 3], total: 10 }, 0)).toBe(3);
    expect(nextPageOffset({ items: [1, 2, 3], total: 3 }, 0)).toBeUndefined();
    expect(nextPageOffset({ items: [], total: 10 }, 0)).toBeUndefined();
    expect(nextPageOffset({ items: [1, 2], total: 12 }, 8)).toBe(10);
  });
});
