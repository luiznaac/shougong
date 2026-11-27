import { describe, expect, it } from "vitest";
import { handwritingCanvasSize } from "./handwriting.ts";

describe("handwritingCanvasSize", () => {
  it("grows a coarse-pointer canvas up to min(90vw, 320px)", () => {
    expect(handwritingCanvasSize("coarse", 390)).toBe(320);
    expect(handwritingCanvasSize("coarse", 320)).toBe(288);
  });

  it("keeps a fine-pointer canvas in the 200-220px range", () => {
    expect(handwritingCanvasSize("fine", 1440)).toBe(220);
    expect(handwritingCanvasSize("fine", 1024)).toBe(220);
  });

  it("shrinks a fine-pointer canvas on a very narrow viewport instead of overflowing", () => {
    expect(handwritingCanvasSize("fine", 200)).toBe(180);
  });

  it("never exceeds 90% of the viewport on either pointer", () => {
    for (let width = 240; width <= 1600; width += 40) {
      expect(handwritingCanvasSize("coarse", width)).toBeLessThanOrEqual(width * 0.9);
      expect(handwritingCanvasSize("fine", width)).toBeLessThanOrEqual(width * 0.9);
    }
  });
});
