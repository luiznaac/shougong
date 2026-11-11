import type { StudyItem } from "../api/types.ts";
import { tileBadges } from "../lib/tileBadges.ts";
import { Icon } from "./icons.tsx";

/**
 * The status marks for a study item — the same ghost/bolt chips the character
 * tile overlays and the item-index rows render, from the one badge source.
 */
export function ItemBadges({ item, size = 14 }: { item: StudyItem; size?: number }) {
  return (
    <>
      {tileBadges(item).map((badge) => (
        <span
          key={badge.kind}
          role="img"
          aria-label={badge.label}
          title={badge.title}
          className="inline-flex rounded-full bg-slate-950/85 p-1 text-slate-300"
        >
          <Icon name={badge.icon} size={size} />
        </span>
      ))}
    </>
  );
}
