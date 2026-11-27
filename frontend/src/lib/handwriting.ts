import type { ElementSize } from "./useElementSize.ts";

/** A coarse pointer is a finger or pen; a fine pointer is a mouse or trackpad. */
export type PointerKind = "coarse" | "fine";

const COARSE_MAX_PX = 320;
const FINE_MAX_PX = 220;

/** The largest square the pointer type calls for, regardless of its slot. */
export function handwritingCanvasCap(pointer: PointerKind): number {
  return pointer === "coarse" ? COARSE_MAX_PX : FINE_MAX_PX;
}

/**
 * The drawing square's side in CSS pixels: the largest square that fits its
 * slot, capped at the pointer-sized maximum. Both slot axes matter — the square
 * must clear the controls beside it (width) and the action dock below it
 * (height) — so a viewport fraction alone cannot size it. The slot is measured
 * by the caller, which is what knows the stage insets and the sibling controls.
 */
export function handwritingCanvasSize(pointer: PointerKind, slot: ElementSize): number {
  const cap = handwritingCanvasCap(pointer);
  return Math.max(0, Math.floor(Math.min(slot.width, slot.height, cap)));
}
