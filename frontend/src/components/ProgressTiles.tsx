import { Link } from "react-router-dom";
import type { StudyItem } from "../api/types.ts";
import { levelColor, levelLabel, levelOf } from "../lib/srs.ts";
import { Pinyin } from "./Pinyin.tsx";
import { Hanzi } from "./Hanzi.tsx";

/** HanziHero-style progress tiles: hanzi + pinyin + meaning, border by SRS level. */
export function ProgressTiles({ items }: { items: StudyItem[] }) {
  const sorted = [...items].sort(
    (a, b) => (b.card.stability ?? 0) - (a.card.stability ?? 0),
  );

  return (
    <div className="flex flex-wrap gap-2">
      {sorted.map((it) => {
        const level = levelOf(it.card);
        return (
          <Link
            key={it.id}
            to={`/items/${it.id}`}
            title={`${levelLabel(level)}`}
            className="flex w-28 flex-col items-center rounded-sm border-b-2 bg-slate-900/60 px-1.5 py-2 text-center transition-colors hover:bg-slate-800"
            style={{ borderColor: levelColor(level) }}
          >
            <span className="max-w-full truncate text-[11px] leading-tight">
              <Pinyin value={it.entry.pinyin} />
            </span>
            <Hanzi
              text={it.entry.simplified}
              singleCharPx={32}
              boxPx={104}
              className="my-1 text-slate-50"
            />
            <span className="line-clamp-1 max-w-full text-[11px] text-slate-400">
              {it.entry.definitions[0]}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
