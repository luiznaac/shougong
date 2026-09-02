import { Link } from "react-router-dom";
import type { StudyItem } from "../api/types.ts";
import { levelColor, levelLabel, levelOf } from "../lib/srs.ts";
import { Pinyin } from "./Pinyin.tsx";

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
            className="flex w-24 flex-col items-center rounded-sm border-b-2 bg-slate-900/60 px-1 py-2 text-center transition-colors hover:bg-slate-800"
            style={{ borderColor: levelColor(level) }}
          >
            <Pinyin value={it.entry.pinyin} className="text-[11px] leading-tight" />
            <span lang="zh-Hans" className="my-1 font-hanzi text-3xl text-slate-50">
              {it.entry.simplified}
            </span>
            <span className="line-clamp-1 text-[11px] text-slate-400">
              {it.entry.definitions[0]}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
