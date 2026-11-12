import { Link } from "react-router-dom";
import type { StudyItem } from "../api/types.ts";
import { itemPath } from "../lib/navigation.ts";
import { EmptyState } from "./EmptyState.tsx";
import { HskChip } from "./HskChip.tsx";
import { Pinyin } from "./Pinyin.tsx";
import { SrsStageChip } from "./SrsStageChip.tsx";

/**
 * Palavras recentes: the handful of latest additions with the stage each one is
 * currently at, so Progresso carries the SRS ladder beside the aggregates. It
 * renders the server's order as received and caps nothing here — the page asks
 * for one bounded page.
 */
export function RecentWords({ items }: { items: StudyItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon="spark"
        title="Nenhuma palavra recente"
        description="As palavras que você adicionar aparecem aqui com o estágio SRS de cada uma."
      />
    );
  }

  return (
    <ul className="divide-y divide-white/5">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            to={itemPath(item.id)}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-2 py-2.5 transition-colors hover:bg-white/5"
          >
            <span lang="zh-Hans" className="font-hanzi text-lg text-slate-100">
              {item.entry.simplified}
            </span>
            <Pinyin value={item.entry.pinyin} className="text-xs font-light" />
            <span className="min-w-0 flex-1 truncate text-xs text-slate-500">
              {item.entry.definitions.join(", ")}
            </span>
            <HskChip level={item.entry.hsk_level} />
            <SrsStageChip card={item.card} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
