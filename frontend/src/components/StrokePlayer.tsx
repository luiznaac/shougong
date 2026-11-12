import { useState } from "react";
import { useCharacterStrokes } from "../api/queries.ts";
import { keyedOccurrences } from "../lib/occurrenceKeys.ts";
import { Skeleton } from "./Skeleton.tsx";
import { StrokeGlyph } from "./StrokeGlyph.tsx";

/**
 * The shared stroke player: exactly one character in a fixed square viewer,
 * a 44px per-character picker whenever the word has more than one hanzi, and
 * ◀ ▶ stepping through that character's strokes. The box is sized from the
 * caller alone, so switching characters never resizes it. The item page is its
 * first consumer; practice adopts the same shape later.
 */
export function StrokePlayer({
  word,
  sizePx,
  className = "",
}: {
  word: string;
  sizePx: number;
  className?: string;
}) {
  const chars = keyedOccurrences([...word], (char) => char);
  const [activeIdx, setActiveIdx] = useState(0);
  const active = chars[Math.min(activeIdx, chars.length - 1)]?.item ?? "";
  const [revealed, setRevealed] = useState(0);

  const { data, isLoading, error } = useCharacterStrokes(active);
  const strokes = data?.strokes ?? [];
  const total = strokes.length;
  const shown = Math.min(revealed, total);
  const counter = `${chars.length > 1 ? `${activeIdx + 1}/${chars.length} · ` : ""}traço ${shown}/${total}`;

  const pick = (index: number) => {
    setActiveIdx(index);
    setRevealed(0);
  };

  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      {chars.length > 1 ? (
        <div className="flex flex-wrap justify-center gap-1.5">
          {chars.map(({ key, item: char }, index) => (
            <button
              key={key}
              type="button"
              onClick={() => pick(index)}
              aria-pressed={index === activeIdx}
              aria-label={`Ver traços de ${char}`}
              className={`font-hanzi h-11 w-11 rounded-lg text-lg transition-colors motion-reduce:transition-none ${
                index === activeIdx
                  ? "bg-white text-slate-900"
                  : "bg-slate-950/50 text-slate-300 ring-1 ring-white/10 hover:text-white"
              }`}
            >
              {char}
            </button>
          ))}
        </div>
      ) : null}

      <div
        className="grid shrink-0 place-items-center rounded-xl bg-slate-950/40 ring-1 ring-white/10"
        style={{ width: sizePx, height: sizePx }}
      >
        {isLoading ? (
          <Skeleton className="h-1/2 w-1/2" />
        ) : error || !data ? (
          <span className="px-3 text-center text-xs text-slate-500">Sem dados de traço.</span>
        ) : (
          <StrokeGlyph character={active} strokes={strokes} revealed={shown} sizePx={sizePx} />
        )}
      </div>

      <div className="flex items-center gap-1.5 rounded-full bg-slate-950/50 px-1.5 py-1 text-[11px] text-slate-300 ring-1 ring-white/10">
        <button
          type="button"
          onClick={() => setRevealed((current) => Math.max(0, Math.min(current, total) - 1))}
          disabled={shown === 0}
          aria-label="Traço anterior"
          className="grid h-11 w-11 place-items-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 motion-reduce:transition-none disabled:opacity-30"
        >
          ◀
        </button>
        <span className="tabular-nums">{counter}</span>
        <button
          type="button"
          onClick={() => setRevealed((current) => Math.min(total, Math.min(current, total) + 1))}
          disabled={shown === total}
          aria-label="Próximo traço"
          className="grid h-11 w-11 place-items-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 motion-reduce:transition-none disabled:opacity-30"
        >
          ▶
        </button>
      </div>
    </div>
  );
}
