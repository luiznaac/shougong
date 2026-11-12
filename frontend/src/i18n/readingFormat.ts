import type { ReadingFormat } from "../api/types.ts";

// pt-BR labels for the backend's reading-format enum. Exhaustive, so a new
// backend value fails the type until it is translated here.
const LABELS_PT: Record<ReadingFormat, string> = {
  paragraph: "Parágrafo",
  sentences: "Frases soltas",
  dialogue: "Diálogo",
};

export function readingFormatLabel(format: ReadingFormat): string {
  return LABELS_PT[format];
}
