import type { SrsCard } from "../api/types.ts";
import { levelColor, levelLabel, levelOf } from "../lib/srs.ts";

/** The one place the five display-group colours meet their stage labels. */
export function SrsStageChip({ card }: { card: SrsCard }) {
  const level = levelOf(card);
  return (
    <span
      className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold text-white"
      style={{ background: levelColor(level) }}
    >
      {levelLabel(level)}
    </span>
  );
}
