import type { StudyItem } from "../api/types.ts";

export type TileBadgeKind = "leech" | "priority";

export interface TileBadge {
  kind: TileBadgeKind;
  emoji: string;
  /** pt-BR accessible name — the meaning survives without the emoji or colour. */
  label: string;
  title: string;
}

const LEECH: TileBadge = {
  kind: "leech",
  emoji: "👻",
  label: "Sanguessuga",
  title: "Sanguessuga — falhas recorrentes",
};

const PRIORITY: TileBadge = {
  kind: "priority",
  emoji: "⚡",
  label: "Prioridade",
  title: "Prioridade — fixado na fila de lições",
};

/** The tile overlays, both derived from the item DTO: ghost first, then bolt. */
export function tileBadges(item: StudyItem): TileBadge[] {
  const badges: TileBadge[] = [];
  if (item.is_leech) badges.push(LEECH);
  if (item.priority_position !== null) badges.push(PRIORITY);
  return badges;
}
