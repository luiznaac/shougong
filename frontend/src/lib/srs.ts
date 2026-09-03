import type { SrsCard } from "../api/types.ts";

// shougong's backend stores raw continuous FSRS (state + stability in days), not a
// discrete SRS level. The HanziHero-style level ladder below is derived here, on
// the client, purely for display — from `stability` (days until retention decays
// to ~90%).

export type SrsLevel =
  | "novice-1"
  | "novice-2"
  | "apprentice-1"
  | "apprentice-2"
  | "journeyman-1"
  | "journeyman-2"
  | "expert-1"
  | "expert-2"
  | "expert-3"
  | "master";

export type SrsGroup = "novice" | "apprentice" | "journeyman" | "expert" | "master";

interface LevelSpec {
  level: SrsLevel;
  group: SrsGroup;
  label: string;
  /** inclusive upper bound of `stability` (days) for this level; Infinity = top */
  maxStabilityDays: number;
}

// Ascending. Thresholds are the interval each level represents.
export const LEVELS: LevelSpec[] = [
  { level: "novice-1", group: "novice", label: "Novice I", maxStabilityDays: 1 },
  { level: "novice-2", group: "novice", label: "Novice II", maxStabilityDays: 4 },
  { level: "apprentice-1", group: "apprentice", label: "Apprentice I", maxStabilityDays: 7 },
  { level: "apprentice-2", group: "apprentice", label: "Apprentice II", maxStabilityDays: 14 },
  { level: "journeyman-1", group: "journeyman", label: "Journeyman I", maxStabilityDays: 30 },
  { level: "journeyman-2", group: "journeyman", label: "Journeyman II", maxStabilityDays: 60 },
  { level: "expert-1", group: "expert", label: "Expert I", maxStabilityDays: 120 },
  { level: "expert-2", group: "expert", label: "Expert II", maxStabilityDays: 240 },
  { level: "expert-3", group: "expert", label: "Expert III", maxStabilityDays: 365 },
  { level: "master", group: "master", label: "Master", maxStabilityDays: Infinity },
];

export const GROUP_ORDER: SrsGroup[] = [
  "novice",
  "apprentice",
  "journeyman",
  "expert",
  "master",
];

export const GROUP_LABEL: Record<SrsGroup, string> = {
  novice: "Novice",
  apprentice: "Apprentice",
  journeyman: "Journeyman",
  expert: "Expert",
  master: "Master",
};

// Ascending ramp, HanziHero-flavoured (grey → sky → violet → cerise → gold).
export const GROUP_COLOR: Record<SrsGroup, string> = {
  novice: "#64748b",
  apprentice: "#0ea5e9",
  journeyman: "#8b5cf6",
  expert: "#e3116c",
  master: "#f59e0b",
};

const BY_LEVEL: Record<SrsLevel, LevelSpec> = Object.fromEntries(
  LEVELS.map((s) => [s.level, s]),
) as Record<SrsLevel, LevelSpec>;

/** Map an FSRS card to a display level by its stability (days). */
export function levelOf(card: SrsCard): SrsLevel {
  const days = card.stability ?? 0;
  for (const spec of LEVELS) {
    if (days <= spec.maxStabilityDays) return spec.level;
  }
  return "master";
}

export function groupOf(card: SrsCard): SrsGroup {
  return BY_LEVEL[levelOf(card)].group;
}

export function levelLabel(level: SrsLevel): string {
  return BY_LEVEL[level].label;
}

export function levelColor(level: SrsLevel): string {
  return GROUP_COLOR[BY_LEVEL[level].group];
}

/** Counts per group, in GROUP_ORDER. */
export function tallyGroups(cards: SrsCard[]): Record<SrsGroup, number> {
  const out: Record<SrsGroup, number> = {
    novice: 0,
    apprentice: 0,
    journeyman: 0,
    expert: 0,
    master: 0,
  };
  for (const c of cards) out[groupOf(c)] += 1;
  return out;
}
