import type { StudyItem } from "../api/types.ts";
import { StudyItemTile } from "./StudyItemTile.tsx";

/** A wrapped grid of character tiles in the order it receives — never re-sorted. */
export function ProgressTiles({ items }: { items: StudyItem[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => (
        <StudyItemTile key={it.id} item={it} />
      ))}
    </div>
  );
}
