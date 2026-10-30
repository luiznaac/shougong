import type { StudyItem } from "../api/types.ts";

/** A minimal study item for tests; override only the fields the test is about. */
export function studyItem(
  overrides: Partial<Omit<StudyItem, "card">> & { card?: Partial<StudyItem["card"]> } = {},
): StudyItem {
  const { card, ...rest } = overrides;
  return {
    id: 1,
    entry: {
      id: 10,
      simplified: "學",
      pinyin: "xue2",
      definitions: ["estudar"],
      hsk_level: 1,
      pos_tags: [],
    },
    card: {
      state: "review",
      due: "2026-10-30T12:00:00Z",
      stability: 30,
      difficulty: 5,
      last_review: "2026-10-29T12:00:00Z",
      ...card,
    },
    created_at: "2026-10-01T12:00:00Z",
    priority_position: null,
    is_leech: false,
    ...rest,
  };
}
