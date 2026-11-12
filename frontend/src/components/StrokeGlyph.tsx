import { keyedOccurrences } from "../lib/occurrenceKeys.ts";

export const STROKE_VIEWBOX = 1024;
// hanzi-writer-data's raw coordinate space has Y increasing upward, with the
// glyph's top-left at (0, 900) — this transform flips + shifts it into a
// normal top-down 0..1024 SVG box.
const RAW_Y_OFFSET = 900;

/**
 * The shared stroke drawing: a faint full outline with the first `revealed`
 * strokes filled in. Both the quiz's `StrokeOrder` and the shared `StrokePlayer`
 * render through this, so the coordinate transform lives in one place.
 */
export function StrokeGlyph({
  character,
  strokes,
  revealed,
  sizePx,
  className = "",
}: {
  character: string;
  strokes: string[];
  revealed: number;
  sizePx: number;
  className?: string;
}) {
  return (
    <svg
      viewBox={`0 0 ${STROKE_VIEWBOX} ${STROKE_VIEWBOX}`}
      style={{ width: sizePx, height: sizePx }}
      role="img"
      aria-label={`Ordem dos traços de ${character}`}
      className={className}
    >
      <title>Ordem dos traços de {character}</title>
      <g transform={`scale(1,-1) translate(0,-${RAW_Y_OFFSET})`}>
        {keyedOccurrences(strokes, (stroke) => stroke).map(({ key, item: d }) => (
          <path key={`bg-${key}`} d={d} className="fill-slate-400/20" />
        ))}
        {keyedOccurrences(strokes.slice(0, revealed), (stroke) => stroke).map(
          ({ key, item: d }) => (
            <path key={`fg-${key}`} d={d} className="fill-accent-500" />
          ),
        )}
      </g>
    </svg>
  );
}
