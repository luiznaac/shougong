import { describe, expect, it } from "vitest";
import {
  CSV_RESULT_PAGE_SIZE,
  DICTIONARY_PAGE_SIZE,
  dictionaryPageRequests,
  dictionaryShown,
} from "./addImport.ts";

describe("dictionary page requests", () => {
  it("asks the desktop pager for exactly its five-row server page", () => {
    expect(dictionaryPageRequests("desktop", 3, DICTIONARY_PAGE_SIZE * 3)).toEqual([
      { limit: 5, offset: 10 },
    ]);
  });

  it("asks mobile for every five-row page it has shown so far", () => {
    expect(dictionaryPageRequests("mobile", 1, 15)).toEqual([
      { limit: 5, offset: 0 },
      { limit: 5, offset: 5 },
      { limit: 5, offset: 10 },
    ]);
  });

  it("always asks for at least one page before any rows are shown", () => {
    expect(dictionaryPageRequests("mobile", 1, 0)).toEqual([{ limit: 5, offset: 0 }]);
  });
});

describe("dictionary shown count", () => {
  it("counts from the server offset on desktop", () => {
    expect(dictionaryShown("desktop", 3, 5)).toBe(15);
  });

  it("counts the received rows on mobile", () => {
    expect(dictionaryShown("mobile", 1, 15)).toBe(15);
  });
});

describe("CSV result paging", () => {
  it("pages the results twelve rows at a time", () => {
    expect(CSV_RESULT_PAGE_SIZE).toBe(12);
  });
});
