import { describe, expect, it } from "vitest";
import { keyedOccurrences } from "./occurrenceKeys.ts";

describe("keyedOccurrences", () => {
  it("keeps the first occurrence's key and suffixes repeated values", () => {
    const entries = keyedOccurrences(["a", "b", "a", "a"], (value) => value);

    expect(entries.map((entry) => entry.key)).toEqual(["a", "b", "a#1", "a#2"]);
    expect(entries.map((entry) => entry.item)).toEqual(["a", "b", "a", "a"]);
  });

  it("keys by the projection, so distinct values never collide", () => {
    const entries = keyedOccurrences(
      [
        { text: "ma", tone: 1 },
        { text: "ma", tone: 2 },
      ],
      (syllable) => `${syllable.text}-${syllable.tone}`,
    );

    expect(entries.map((entry) => entry.key)).toEqual(["ma-1", "ma-2"]);
  });
});
