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

export type RevealTarget = "peek" | "whole";

/**
 * What a reveal shows. Any character before the last one peeks at just that
 * character, so the learner can check it and carry on; the last character's
 * reveal compares the whole word.
 */
export function revealTarget(index: number, count: number): RevealTarget {
  return index >= count - 1 ? "whole" : "peek";
}

export type CompletionStep = "next" | "revealed" | "waiting";

/**
 * What completing a character does. A character before the last advances to the
 * next; the last character reveals the whole word automatically when
 * auto-reveal is on, and otherwise waits for the learner to tap "Revelar".
 */
export function afterCharacterComplete(
  index: number,
  count: number,
  autoReveal: boolean,
): CompletionStep {
  if (revealTarget(index, count) === "peek") return "next";
  return autoReveal ? "revealed" : "waiting";
}
