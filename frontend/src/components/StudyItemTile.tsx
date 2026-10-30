import { Link } from "react-router-dom";
import type { StudyItem } from "../api/types.ts";
import { levelColor, levelLabel, levelOf } from "../lib/srs.ts";
import { tileBadges } from "../lib/tileBadges.ts";
import { Hanzi } from "./Hanzi.tsx";
import { Pinyin } from "./Pinyin.tsx";

/**
 * HanziHero-style character tile: hanzi + pinyin + meaning, border by SRS level.
 * The ghost (leech) and bolt (priority) overlays derive from the item DTO and
 * live inside the tile link; the quiz runner never renders this component.
 */
export function StudyItemTile({ item }: { item: StudyItem }) {
  const level = levelOf(item.card);
  return (
    <Link
      to={`/items/${item.id}`}
      title={levelLabel(level)}
      className="relative flex w-28 flex-col items-center rounded-sm border-b-2 bg-slate-900/60 px-1.5 py-2 text-center transition-colors hover:bg-slate-800"
      style={{ borderColor: levelColor(level) }}
    >
      <span className="absolute top-1 right-1 flex gap-0.5">
        {tileBadges(item).map((badge) => (
          <span
            key={badge.kind}
            role="img"
            aria-label={badge.label}
            title={badge.title}
            className="rounded-full bg-slate-950/85 px-1 text-[10px] leading-4"
          >
            {badge.emoji}
          </span>
        ))}
      </span>
      <span className="max-w-full truncate text-[11px] leading-tight">
        <Pinyin value={item.entry.pinyin} />
      </span>
      <Hanzi
        text={item.entry.simplified}
        singleCharPx={32}
        boxPx={104}
        className="my-1 text-slate-50"
      />
      <span className="line-clamp-1 max-w-full text-[11px] text-slate-400">
        {item.entry.definitions[0]}
      </span>
    </Link>
  );
}
