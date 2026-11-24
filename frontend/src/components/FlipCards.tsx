import { flipLayout } from "../lib/flipCards.ts";
import { keyedOccurrences } from "../lib/occurrenceKeys.ts";
import { levelLabel } from "./HskChip.tsx";

/**
 * One character as a flip tile. The whole row flips together (same `hidden`):
 * the front is the character, the back a dashed "?". When the character is in
 * view its writing level sits underneath; a character with no level reads "—"
 * and is labelled unknown to assistive tech.
 */
export function FlipTile({
  char,
  writingLevel,
  hidden,
  sizePx,
}: {
  char: string;
  writingLevel: number | null;
  hidden: boolean;
  sizePx: number;
}) {
  const radius = Math.min(20, Math.max(6, Math.round(sizePx * 0.16)));
  return (
    <div className="flex flex-col items-center gap-1" style={{ perspective: "1200px" }}>
      <div
        style={{ width: sizePx, height: sizePx }}
        className={`relative transition-transform duration-500 [transform-style:preserve-3d] [will-change:transform] motion-reduce:transition-none ${
          hidden ? "[transform:rotateY(180deg)]" : "[transform:rotateY(0deg)]"
        }`}
      >
        <div
          style={{ borderRadius: radius }}
          className="absolute inset-0 flex items-center justify-center border border-white/25 bg-white/10 shadow-[0_20px_50px_-24px_rgba(0,0,0,0.9)] backdrop-blur-sm [backface-visibility:hidden]"
        >
          <span
            lang="zh-Hans"
            className="font-hanzi leading-none text-white"
            style={{ fontSize: sizePx * 0.6 }}
          >
            {char}
          </span>
        </div>
        <div
          style={{ borderRadius: radius }}
          className="absolute inset-0 flex items-center justify-center border-2 border-dashed border-white/40 bg-slate-950/20 [backface-visibility:hidden] [transform:rotateY(180deg)]"
        >
          <span
            aria-hidden
            lang="zh-Hans"
            className="font-hanzi leading-none text-white/50 select-none"
            style={{ fontSize: sizePx * 0.5 }}
          >
            ?
          </span>
        </div>
      </div>
      {!hidden && (
        <span
          aria-label={`Nível de escrita de ${char}: ${writingLevel == null ? "desconhecido" : writingLevel}`}
          title={
            writingLevel == null
              ? "Nível de escrita desconhecido"
              : `Nível de escrita ${writingLevel}`
          }
          className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] leading-none text-slate-200 tabular-nums"
        >
          {writingLevel == null ? "—" : levelLabel(writingLevel)}
        </span>
      )}
    </div>
  );
}

/**
 * One word's characters as flip tiles, sized to the frame they live in:
 * shrink per character to the 56px floor, then wrap into balanced rows. Tiles
 * are keyed per occurrence, so repeated characters keep their own tile.
 */
export function FlipCards({
  chars,
  writingLevels,
  hidden,
  available,
  min = 56,
}: {
  chars: string[];
  writingLevels: Record<string, number | null>;
  hidden: boolean;
  available: number;
  min?: number;
}) {
  const { size, rows } = flipLayout({ count: chars.length, available, min });

  return (
    <div className="flex flex-col items-center gap-2">
      {keyedOccurrences(rows, (row) => row.join("-")).map(({ key: rowKey, item: row }) => (
        <div key={rowKey} className="flex items-center justify-center" style={{ gap: 10 }}>
          {keyedOccurrences(row, (index) => chars[index]).map(({ key: charKey, item: index }) => (
            <FlipTile
              key={charKey}
              char={chars[index]}
              writingLevel={writingLevels[chars[index]] ?? null}
              hidden={hidden}
              sizePx={size}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
