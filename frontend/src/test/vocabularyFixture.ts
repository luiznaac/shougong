import type { VocabularySummary } from "../api/types.ts";

/** A minimal vocabulary summary for tests; override only the fields under test. */
export function vocabularySummary(overrides: Partial<VocabularySummary> = {}): VocabularySummary {
  return {
    total: 12,
    categorised: 10,
    by_category: { noun: 6, verb: 4, qualifier: 1 },
    by_hsk_level: { "1": 4, "2": 3, "3": 2, none: 3 },
    qualifier_shortage: false,
    proficiency: { coverage_by_level: { "1": 0.8, "2": 0.5, "3": 0.25 }, estimated_level: 2 },
    ...overrides,
  };
}
