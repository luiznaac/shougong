import type { StudyItem } from "../api/types.ts";
import { StudyItemTile } from "./StudyItemTile.tsx";
import { Icon } from "./icons.tsx";

/** The fluid tile flow shared by the grid and its loading skeleton. */
export const CHARACTER_GRID_CLASS =
  "grid grid-cols-[repeat(auto-fill,minmax(44px,1fr))] gap-1.5 md:grid-cols-[repeat(auto-fill,minmax(54px,1fr))]";

/**
 * The one character grid: hanzi-only tiles in a fluid column flow, rendered in
 * the order it receives — never re-sorted. An optional `onLoadMore` appends the
 * dashed "+" tile the dashboard grid uses to grow in place.
 */
export function CharacterTileGrid({
  items,
  onLoadMore,
}: {
  items: StudyItem[];
  onLoadMore?: () => void;
}) {
  return (
    <div className={CHARACTER_GRID_CLASS}>
      {items.map((item) => (
        <StudyItemTile key={item.id} item={item} />
      ))}
      {onLoadMore ? (
        <button
          type="button"
          onClick={onLoadMore}
          aria-label="Carregar mais caracteres"
          title="Carregar mais"
          className="grid aspect-square w-full min-w-0 place-items-center rounded-md border border-dashed border-white/15 text-slate-500 transition-colors hover:border-accent-500/60 hover:text-accent-300"
        >
          <Icon name="plus" size={16} />
        </button>
      ) : null}
    </div>
  );
}
