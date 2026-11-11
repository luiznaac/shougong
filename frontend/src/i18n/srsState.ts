import type { SrsState } from "../api/types.ts";

// Translates the backend's FSRS state (English) into Portuguese for display.
const LABELS_PT: Record<SrsState, string> = {
  learning: "Aprendendo",
  review: "Em revisão",
  relearning: "Reaprendendo",
};

export function srsStateLabel(state: SrsState): string {
  return LABELS_PT[state];
}
