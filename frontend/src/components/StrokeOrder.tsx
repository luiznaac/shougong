import { useState } from "react";
import { useCharacterStrokes } from "../api/queries.ts";
import { StrokeGlyph } from "./StrokeGlyph.tsx";

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
      <StrokeGlyph
        character={character}
        strokes={data.strokes}
        revealed={revealed}
        sizePx={sizePx}
        className="rounded-lg bg-slate-800/40"
      />

      <div className="flex items-center gap-2 text-sm">
        <button
          type="button"
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
          type="button"
          onClick={() => setRevealed((r) => Math.min(total, r + 1))}
          disabled={revealed === total}
          className="rounded-md bg-slate-800 px-2.5 py-1 text-slate-300 disabled:opacity-30"
        >
          Próximo →
        </button>
        <button
          type="button"
          onClick={() => setRevealed(0)}
          className="ml-1 text-xs text-slate-500 hover:text-slate-300"
        >
          reiniciar
        </button>
        <button
          type="button"
          onClick={() => setRevealed(total)}
          className="text-xs text-slate-500 hover:text-slate-300"
        >
          mostrar tudo
        </button>
      </div>
    </div>
  );
}
