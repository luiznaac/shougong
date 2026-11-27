import { useCallback, useSyncExternalStore } from "react";
import { useMediaQuery } from "./useMediaQuery.ts";

/** A coarse pointer is a finger or pen; a fine pointer is a mouse or trackpad. */
export type PointerKind = "coarse" | "fine";

const COARSE_MAX_PX = 320;
const FINE_MAX_PX = 220;
/** Either way the square keeps a margin, so it never overflows the stage. */
const VIEWPORT_FRACTION = 0.9;

/**
 * The drawing square's side in CSS pixels: a finger-sized canvas under a coarse
 * pointer, a mouse-sized one under a fine pointer. Both are capped at 90% of
 * the viewport width, so the square stays inside the stage on any screen.
 */
export function handwritingCanvasSize(pointer: PointerKind, viewportWidth: number): number {
  const cap = pointer === "coarse" ? COARSE_MAX_PX : FINE_MAX_PX;
  return Math.floor(Math.min(viewportWidth * VIEWPORT_FRACTION, cap));
}

function useViewportWidth(): number {
  const subscribe = useCallback((onChange: () => void) => {
    window.addEventListener("resize", onChange);
    return () => window.removeEventListener("resize", onChange);
  }, []);

  return useSyncExternalStore(
    subscribe,
    () => window.innerWidth,
    () => 0,
  );
}

/** The drawing square's side for the active pointer type and the current viewport. */
export function useHandwritingCanvasSize(): number {
  const coarsePointer = useMediaQuery("(pointer: coarse)");
  const viewportWidth = useViewportWidth();
  return handwritingCanvasSize(coarsePointer ? "coarse" : "fine", viewportWidth);
}
