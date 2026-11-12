import { describe, expect, it } from "vitest";
import { vocabularySummary } from "../test/vocabularyFixture.ts";
import { categoryRows, estimatedLevelLabel, hskCoverageRows } from "./progress.ts";

describe("hskCoverageRows", () => {
  it("orders the coverage levels numerically and joins the known counts", () => {
    const rows = hskCoverageRows(vocabularySummary());

    expect(rows).toEqual([
      { level: 1, known: 4, coverage: 0.8 },
      { level: 2, known: 3, coverage: 0.5 },
      { level: 3, known: 2, coverage: 0.25 },
    ]);
  });

  it("defaults a known count to zero when the level has no queue words", () => {
    const rows = hskCoverageRows(
      vocabularySummary({
        by_hsk_level: { "1": 4 },
        proficiency: { coverage_by_level: { "1": 0.8, "2": 0.1 }, estimated_level: 1 },
      }),
    );

    expect(rows[1]).toEqual({ level: 2, known: 0, coverage: 0.1 });
  });

  it("is empty when the dictionary carries no HSK totals", () => {
    expect(
      hskCoverageRows(
        vocabularySummary({ proficiency: { coverage_by_level: {}, estimated_level: 0 } }),
      ),
    ).toEqual([]);
  });
});

describe("estimatedLevelLabel", () => {
  it("names a mastered contiguous HSK level", () => {
    expect(estimatedLevelLabel(3)).toBe("HSK 3");
  });

  it("falls back to beginner at zero", () => {
    expect(estimatedLevelLabel(0)).toBe("Iniciante");
  });
});

describe("categoryRows", () => {
  it("orders the categories by count and translates their labels", () => {
    expect(categoryRows({ noun: 6, verb: 4, qualifier: 1 })).toEqual([
      { category: "noun", label: "substantivo", count: 6 },
      { category: "verb", label: "verbo", count: 4 },
      { category: "qualifier", label: "qualificador", count: 1 },
    ]);
  });

  it("drops categories with no words and classes outside the translated enum", () => {
    expect(categoryRows({ noun: 2, verb: 0, tense: 4 })).toEqual([
      { category: "noun", label: "substantivo", count: 2 },
    ]);
  });
});
