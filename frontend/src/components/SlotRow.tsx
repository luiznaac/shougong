import { keyedOccurrences } from "../lib/occurrenceKeys.ts";
import { type SlotCapture, type SlotState, slotState } from "../lib/selfCheck.ts";
import { StrokeGlyph } from "./StrokeGlyph.tsx";

const SLOT_SIZE = 56;
const COMPARE_SIZE = 80;

/** The placeholder a slot shows before the character has a drawing. */
function EmptySlot({ sizePx }: { sizePx: number }) {
  return (
    <div
      style={{ width: sizePx, height: sizePx }}
      className="grid place-items-center rounded-lg bg-slate-800/30 text-slate-600"
    >
      ·
    </div>
  );
}

/**
 * The learner's accepted strokes replayed as a static, non-interactive glyph.
 * These paths already live in the drawing canvas's pixel space (no Y-flip), so
 * they render in their own viewBox rather than through `StrokeGlyph`, which owns
 * the reference data's flipped 1024 box.
 */
function LearnerGlyph({
  character,
  drawing,
  sizePx,
  className = "",
}: {
  character: string;
  drawing: SlotCapture["drawing"];
  sizePx: number;
  className?: string;
}) {
  return (
    <svg
      viewBox={`0 0 ${drawing.size} ${drawing.size}`}
      style={{ width: sizePx, height: sizePx }}
      role="img"
      aria-label={`Seu traço de ${character}`}
      className={`rounded-lg bg-slate-800/40 ring-1 ring-white/10 ${className}`}
    >
      <title>Seu traço de {character}</title>
      {keyedOccurrences(drawing.strokes, (d) => d).map(({ key, item: d }) => (
        <path
          key={key}
          d={d}
          fill="none"
          stroke="currentColor"
          strokeWidth={drawing.size * 0.02}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-slate-200"
        />
      ))}
    </svg>
  );
}

/**
 * The model beside the learner's drawing: a static glyph from the character's
 * already-fetched reference strokes, never a live writer or a new request. A
 * character with no stroke data falls back to its plain hanzi.
 */
function ModelGlyph({
  character,
  strokes,
  sizePx,
  className = "",
}: {
  character: string;
  strokes: string[];
  sizePx: number;
  className?: string;
}) {
  if (strokes.length === 0) {
    return (
      <span
        lang="zh-Hans"
        role="img"
        aria-label={`Modelo de ${character}`}
        style={{ width: sizePx, height: sizePx, fontSize: sizePx * 0.6 }}
        className={`grid place-items-center rounded-lg bg-slate-800/40 font-hanzi leading-none text-white ring-1 ring-white/10 ${className}`}
      >
        {character}
      </span>
    );
  }
  return (
    <StrokeGlyph
      character={character}
      strokes={strokes}
      revealed={strokes.length}
      sizePx={sizePx}
      className={className}
    />
  );
}

function SlotBadge({ index, state }: { index: number; state: SlotState }) {
  return (
    <span
      aria-hidden
      className={`absolute -top-2 left-1.5 rounded-full px-1.5 text-[9px] font-semibold tabular-nums ${
        state === "current" ? "bg-accent-500 text-white" : "bg-slate-950 text-slate-400"
      }`}
    >
      {index + 1}
    </span>
  );
}

function RecallSlot({
  index,
  character,
  snapshot,
  state,
}: {
  index: number;
  character: string;
  snapshot: SlotCapture | null;
  state: SlotState;
}) {
  const current = state === "current";
  return (
    <li
      aria-current={current ? "step" : undefined}
      aria-label={`Caractere ${index + 1}`}
      className={`relative shrink-0 rounded-xl p-1 ring-1 ${
        current ? "bg-white/10 ring-2 ring-accent-500" : "bg-slate-900/60 ring-white/10"
      }`}
    >
      <SlotBadge index={index} state={state} />
      {snapshot && snapshot.drawing.strokes.length > 0 ? (
        <LearnerGlyph character={character} drawing={snapshot.drawing} sizePx={SLOT_SIZE} />
      ) : (
        <EmptySlot sizePx={SLOT_SIZE} />
      )}
    </li>
  );
}

function ComparisonSlot({
  character,
  snapshot,
  model,
}: {
  character: string;
  snapshot: SlotCapture | null;
  model: string[];
}) {
  return (
    <li
      aria-label={`Comparação de ${character}`}
      className="shrink-0 rounded-xl bg-slate-900/70 p-2 ring-1 ring-white/10"
    >
      <div className="grid grid-cols-2 gap-2">
        <figure className="flex flex-col items-center">
          <figcaption className="pb-1 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
            Seu traço
          </figcaption>
          {snapshot && snapshot.drawing.strokes.length > 0 ? (
            <LearnerGlyph character={character} drawing={snapshot.drawing} sizePx={COMPARE_SIZE} />
          ) : (
            <EmptySlot sizePx={COMPARE_SIZE} />
          )}
        </figure>
        <figure className="flex flex-col items-center">
          <figcaption className="pb-1 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
            Modelo
          </figcaption>
          <ModelGlyph character={character} strokes={model} sizePx={COMPARE_SIZE} />
        </figure>
      </div>
    </li>
  );
}

export type SlotReveal = "none" | "peek" | "whole";

/**
 * The word's per-character row, always one slot per character — a lone character
 * too. During recall the slot being drawn is highlighted and completed slots
 * hold the learner's snapshot. An early peek compares only the current slot;
 * the final reveal compares every slot's learner drawing beside its model.
 */
export function SlotRow({
  chars,
  snapshots,
  currentIdx,
  reveal = "none",
  peekModel = [],
}: {
  chars: string[];
  snapshots: (SlotCapture | null)[];
  currentIdx: number;
  reveal?: SlotReveal;
  peekModel?: string[];
}) {
  return (
    <ul
      aria-label="Progresso por caractere"
      className="flex w-full items-start gap-2 overflow-x-auto pb-1"
    >
      {keyedOccurrences(chars, (char) => char).map(({ key, item: character }, index) => {
        const snapshot = snapshots[index] ?? null;
        const comparing = reveal === "whole" || (reveal === "peek" && index === currentIdx);
        return comparing ? (
          <ComparisonSlot
            key={key}
            character={character}
            snapshot={snapshot}
            model={snapshot?.model ?? (reveal === "peek" ? peekModel : [])}
          />
        ) : (
          <RecallSlot
            key={key}
            index={index}
            character={character}
            snapshot={snapshot}
            state={slotState(index, currentIdx, snapshot)}
          />
        );
      })}
    </ul>
  );
}
