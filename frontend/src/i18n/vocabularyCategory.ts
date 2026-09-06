// Translates the backend's VocabularyCategory (always English — see api/types.ts)
// into Portuguese for display. Backend content stays English-only.
import type { VocabularyCategory } from "../api/types.ts";

const LABELS_PT: Record<VocabularyCategory, string> = {
  verb: "verbo",
  noun: "substantivo",
  person: "pessoa",
  place: "lugar",
  qualifier: "qualificador",
  adverb: "advérbio",
  time: "tempo",
  quantity: "quantidade",
  connective: "conectivo",
  pronoun: "pronome",
  functional: "funcional",
  other: "outro",
};

export const VOCABULARY_CATEGORIES = Object.keys(LABELS_PT) as VocabularyCategory[];

export function vocabularyCategoryLabel(value: VocabularyCategory): string {
  return LABELS_PT[value];
}
