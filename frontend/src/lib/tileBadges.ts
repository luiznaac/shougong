import type { StudyItem } from "../api/types.ts";
import { isPinned } from "./lessonQueue.ts";

export type TileBadgeKind = "leech" | "priority";

export interface TileBadge {
  kind: TileBadgeKind;
  /** pt-BR accessible name — the meaning survives without the drawn icon. */
  label: string;
  title: string;
}

const LEECH: TileBadge = {
  kind: "leech",
  label: "Sanguessuga",
  title: "Sanguessuga — falhas recorrentes",
};

const PRIORITY: TileBadge = {
  kind: "priority",
  label: "Prioridade",
  title: "Prioridade — fixado na fila de lições",
};

/** The tile overlays, both derived from the item DTO: ghost first, then bolt. */
export function tileBadges(item: StudyItem): TileBadge[] {
  const badges: TileBadge[] = [];
  if (item.is_leech) badges.push(LEECH);
  if (isPinned(item)) badges.push(PRIORITY);
  return badges;
}
