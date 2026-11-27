import { describe, expect, it } from "vitest";
import { handwritingCanvasSize } from "./handwriting.ts";

describe("handwritingCanvasSize", () => {
  it("fits a coarse-pointer square to the smaller slot axis, capped at 320px", () => {
    expect(handwritingCanvasSize("coarse", { width: 270, height: 400 })).toBe(270);
    expect(handwritingCanvasSize("coarse", { width: 600, height: 295 })).toBe(295);
    expect(handwritingCanvasSize("coarse", { width: 600, height: 600 })).toBe(320);
  });

  it("fits a fine-pointer square to the smaller slot axis, capped at 220px", () => {
    expect(handwritingCanvasSize("fine", { width: 448, height: 320 })).toBe(220);
    expect(handwritingCanvasSize("fine", { width: 200, height: 320 })).toBe(200);
    expect(handwritingCanvasSize("fine", { width: 600, height: 150 })).toBe(150);
  });

  it("fits the slot left by a 320, 375 and 390 wide phone beside Limpar", () => {
    // ~73px for Limpar + gap, and less vertical room on the shorter phones.
    expect(handwritingCanvasSize("coarse", { width: 215, height: 229 })).toBe(215);
    expect(handwritingCanvasSize("coarse", { width: 270, height: 295 })).toBe(270);
    expect(handwritingCanvasSize("coarse", { width: 285, height: 300 })).toBe(285);
    expect(handwritingCanvasSize("coarse", { width: 285, height: 250 })).toBe(250);
    // A fine pointer on the same slots stays under its 220px cap.
    expect(handwritingCanvasSize("fine", { width: 215, height: 229 })).toBe(215);
    expect(handwritingCanvasSize("fine", { width: 270, height: 295 })).toBe(220);
    expect(handwritingCanvasSize("fine", { width: 285, height: 250 })).toBe(220);
  });

  it("never exceeds the smaller slot axis or the pointer cap", () => {
    for (const pointer of ["coarse", "fine"] as const) {
      const cap = pointer === "coarse" ? 320 : 220;
      for (let width = 0; width <= 800; width += 40) {
        for (let height = 0; height <= 800; height += 40) {
          expect(handwritingCanvasSize(pointer, { width, height })).toBeLessThanOrEqual(
            Math.min(width, height, cap),
          );
        }
      }
    }
  });

  it("floors to a whole pixel and never returns a negative size", () => {
    expect(handwritingCanvasSize("coarse", { width: 270.9, height: 295.9 })).toBe(270);
    expect(handwritingCanvasSize("coarse", { width: 0, height: 400 })).toBe(0);
    expect(handwritingCanvasSize("coarse", { width: -10, height: 400 })).toBe(0);
    expect(handwritingCanvasSize("fine", { width: 100, height: -5 })).toBe(0);
  });
});
