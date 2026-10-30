import type { StudyItem } from "../api/types.ts";

export type CharacterFilter = "all" | "leeches";

/**
 * `Todas` keeps the existing stability sort; `Sanguessugas` renders the server's
 * worst-first order verbatim — never re-sort the leech list.
 */
export function orderCharacterTiles(
  filter: CharacterFilter,
  { all, leeches }: { all: StudyItem[]; leeches: StudyItem[] },
): StudyItem[] {
  if (filter === "leeches") return leeches;
  return [...all].sort((a, b) => (b.card.stability ?? 0) - (a.card.stability ?? 0));
}
