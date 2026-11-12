import type { StudyItemSort } from "../api/types.ts";

// Translates the backend's study-item sort enum into the filter panel's labels.
// Exhaustive: a new sort value fails the type until it gets a label here.
const LABELS_PT: Record<StudyItemSort, string> = {
  due_asc: "Vencimento (mais próximo)",
  created_desc: "Adicionados recentemente",
  stability_asc: "Estabilidade (menor)",
};

export const SORT_ORDER: StudyItemSort[] = ["due_asc", "created_desc", "stability_asc"];

export function sortOrderLabel(sort: StudyItemSort): string {
  return LABELS_PT[sort];
}
