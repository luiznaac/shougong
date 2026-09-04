import { useMemo, useState } from "react";
import { StrokeOrder } from "./StrokeOrder.tsx";

/**
 * Word-level wrapper around `StrokeOrder`: splits a (possibly multi-character)
 * word into individual hanzi and lets the user pick which one to inspect.
 */
export function StrokeOrderPanel({
  word,
  sizePx,
}: {
  word: string;
  sizePx?: number;
}) {
  const chars = useMemo(() => [...word], [word]);
  const [activeIdx, setActiveIdx] = useState(0);
  const active = chars[Math.min(activeIdx, chars.length - 1)] ?? chars[0];

  return (
    <div className="flex flex-col items-center gap-3">
      {chars.length > 1 && (
        <div className="flex flex-wrap justify-center gap-2">
          {chars.map((c, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              className={`font-hanzi rounded-md px-3 py-1 text-lg transition-colors ${
                i === activeIdx ? "bg-accent-500 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}
      {/* `key` forces a full remount (fresh revealed-stroke count) on character switch */}
      <StrokeOrder key={active} character={active} sizePx={sizePx} />
    </div>
  );
}
