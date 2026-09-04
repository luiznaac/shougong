import { useState } from "react";
import { useCharacterStrokes } from "../api/queries.ts";

const VIEWBOX_SIZE = 1024;
// hanzi-writer-data's raw coordinate space has Y increasing upward, with the
// glyph's top-left at (0, 900) — this transform flips + shifts it into a
// normal top-down 0..1024 SVG box.
const RAW_Y_OFFSET = 900;

/**
 * Pleco-style stroke order viewer for a single character: full outline shown
 * faintly, strokes revealed one at a time via Prev/Next — no auto-animation.
 */
export function StrokeOrder({
  character,
  sizePx = 160,
}: {
  character: string;
  sizePx?: number;
}) {
  const { data, isLoading, error } = useCharacterStrokes(character);
  const [revealed, setRevealed] = useState(0);

  if (isLoading) return <div style={{ width: sizePx, height: sizePx }} />;
  if (error || !data) return null; // no stroke data for this character — hide the widget

  const total = data.strokes.length;

  return (
    <div className="flex flex-col items-center gap-2">
      <svg
        viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
        style={{ width: sizePx, height: sizePx }}
        className="rounded-lg bg-slate-800/40"
      >
        <g transform={`scale(1,-1) translate(0,-${RAW_Y_OFFSET})`}>
          {data.strokes.map((d, i) => (
            <path key={`bg-${i}`} d={d} className="fill-slate-400/20" />
          ))}
          {data.strokes.slice(0, revealed).map((d, i) => (
            <path key={`fg-${i}`} d={d} className="fill-accent-500" />
          ))}
        </g>
      </svg>

      <div className="flex items-center gap-2 text-sm">
        <button
          onClick={() => setRevealed((r) => Math.max(0, r - 1))}
          disabled={revealed === 0}
          className="rounded-md bg-slate-800 px-2.5 py-1 text-slate-300 disabled:opacity-30"
        >
          ← Anterior
        </button>
        <span className="tabular-nums text-slate-400">
          traço {revealed}/{total}
        </span>
        <button
          onClick={() => setRevealed((r) => Math.min(total, r + 1))}
          disabled={revealed === total}
          className="rounded-md bg-slate-800 px-2.5 py-1 text-slate-300 disabled:opacity-30"
        >
          Próximo →
        </button>
        <button onClick={() => setRevealed(0)} className="ml-1 text-xs text-slate-500 hover:text-slate-300">
          reiniciar
        </button>
        <button onClick={() => setRevealed(total)} className="text-xs text-slate-500 hover:text-slate-300">
          mostrar tudo
        </button>
      </div>
    </div>
  );
}
