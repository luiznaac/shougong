import { Link } from "react-router-dom";
import type { StudyItem } from "../api/types.ts";
import { itemPath } from "../lib/navigation.ts";
import { levelColor, levelLabel, levelOf } from "../lib/srs.ts";
import { Hanzi } from "./Hanzi.tsx";
import { ItemBadges } from "./ItemBadges.tsx";

/**
 * The one character tile: hanzi-only, fluid inside its grid, with the SRS level
 * colour on the bottom edge. The ghost (leech) and bolt (priority) overlays are
 * drawn icons that derive from the item DTO; the quiz runner never renders this.
 */
export function StudyItemTile({ item }: { item: StudyItem }) {
  const level = levelOf(item.card);
  return (
    <Link
      to={itemPath(item.id)}
      title={levelLabel(level)}
      className="relative grid aspect-square w-full min-w-0 place-items-center rounded-md border-b-2 bg-slate-900/60 transition-colors hover:bg-slate-800"
      style={{ borderColor: levelColor(level) }}
    >
      <span className="absolute top-0.5 right-0.5 flex gap-0.5">
        <ItemBadges item={item} size={11} />
      </span>
      <Hanzi text={item.entry.simplified} singleCharPx={30} boxPx={54} className="text-slate-50" />
    </Link>
  );
}
