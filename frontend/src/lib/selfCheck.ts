/**
 * The learner's drawing for one character: the accepted stroke `d` strings in
 * the drawing canvas's pixel space, plus the canvas side so it can be replayed
 * at any size without re-deriving the coordinate space.
 */
export interface LearnerDrawing {
  strokes: string[];
  size: number;
}

/**
 * One slot's self-check capture, taken when the character's drawing completes:
 * the learner's drawing and the model's reference stroke paths (the data the
 * handwriting child already fetched, so the comparison needs no new request).
 */
export interface SlotCapture {
  drawing: LearnerDrawing;
  model: string[];
}

export type SlotState = "current" | "completed" | "upcoming";

/**
 * How one slot of the word's slot row presents during recall. The character
 * being drawn is current; anything already drawn (or stepped past) is completed;
 * the rest are upcoming. At the comparison the row ignores this and shows every
 * pair.
 */
export function slotState(
  index: number,
  currentIdx: number,
  capture: SlotCapture | null,
): SlotState {
  if (index === currentIdx) return "current";
  if (index < currentIdx || capture) return "completed";
  return "upcoming";
}
