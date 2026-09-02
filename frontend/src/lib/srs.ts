import type { SrsCard } from "../api/types.ts";

// shougong's backend does not model named SRS stages — it stores raw FSRS
// (state + stability in days). WaniKani-style buckets are derived here, on the
// client, purely for display: progress bars, dashboard counts, item pages.

export type SrsStage =
  | "apprentice"
  | "guru"
  | "master"
  | "enlightened"
  | "burned";

export const STAGE_ORDER: SrsStage[] = [
  "apprentice",
  "guru",
  "master",
  "enlightened",
  "burned",
];

export const STAGE_LABEL: Record<SrsStage, string> = {
  apprentice: "Aprendiz",
  guru: "Guru",
  master: "Mestre",
  enlightened: "Iluminado",
  burned: "Queimado",
};

export const STAGE_COLOR: Record<SrsStage, string> = {
  apprentice: "var(--color-srs-apprentice)",
  guru: "var(--color-srs-guru)",
  master: "var(--color-srs-master)",
  enlightened: "var(--color-srs-enlightened)",
  burned: "var(--color-srs-burned)",
};

/** Map an FSRS card to a display stage by scheduled interval (stability ≈ days). */
export function stageOf(card: SrsCard): SrsStage {
  if (card.state === "learning" || card.state === "relearning") return "apprentice";
  const days = card.stability ?? 0;
  if (days < 7) return "apprentice";
  if (days < 30) return "guru";
  if (days < 120) return "master";
  if (days < 365) return "enlightened";
  return "burned";
}

export function tallyStages(cards: SrsCard[]): Record<SrsStage, number> {
  const out: Record<SrsStage, number> = {
    apprentice: 0,
    guru: 0,
    master: 0,
    enlightened: 0,
    burned: 0,
  };
  for (const c of cards) out[stageOf(c)] += 1;
  return out;
}
