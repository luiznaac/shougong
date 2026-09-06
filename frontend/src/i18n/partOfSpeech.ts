// Translates the backend's PartOfSpeech (always English — see api/types.ts)
// into Portuguese for display. Backend content stays English-only; any
// user-facing translation belongs here in the frontend.
import type { PartOfSpeech } from "../api/types.ts";

const LABELS_PT: Record<PartOfSpeech, string> = {
  noun: "substantivo",
  verb: "verbo",
  adjective: "adjetivo",
  adverb: "advérbio",
  pronoun: "pronome",
  numeral: "numeral",
  quantifier: "quantificador",
  preposition: "preposição",
  conjunction: "conjunção",
  particle: "partícula",
  other: "outro",
};

export function partOfSpeechLabel(value: PartOfSpeech | null): string | null {
  return value == null ? null : LABELS_PT[value];
}
