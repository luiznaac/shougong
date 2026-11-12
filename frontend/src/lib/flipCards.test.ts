import { describe, expect, it } from "vitest";
import { flipLayout } from "./flipCards.ts";

describe("flipLayout", () => {
  it("keeps a short word on one row at the size cap", () => {
    expect(flipLayout({ count: 2, available: 430 })).toEqual({
      size: 132,
      rows: [[0, 1]],
    });
  });

  it("shrinks per character until it reaches the floor, then wraps", () => {
    expect(flipLayout({ count: 7, available: 300 })).toEqual({
      size: 67,
      rows: [
        [0, 1, 2, 3],
        [4, 5, 6],
      ],
    });
  });

  it("balances the rows a five- to seven-character word wraps into", () => {
    for (const count of [5, 6, 7]) {
      const { rows } = flipLayout({ count, available: 300 });
      const lengths = rows.map((row) => row.length);
      expect(Math.max(...lengths) - Math.min(...lengths)).toBeLessThanOrEqual(1);
      expect(rows.flat()).toEqual(Array.from({ length: count }, (_, index) => index));
    }
  });

  it("renders nothing for an empty word", () => {
    expect(flipLayout({ count: 0, available: 300 })).toEqual({ size: 56, rows: [] });
  });
});
