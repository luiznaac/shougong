import { describe, expect, it } from "vitest";
import { type SlotCapture, slotState } from "./selfCheck.ts";

const snapshot: SlotCapture = {
  drawing: { strokes: ["M0 0 L10 10"], size: 170 },
  model: ["M0 0 L10 10"],
};

describe("slotState", () => {
  it("marks the character currently being drawn as current", () => {
    expect(slotState(0, 0, null)).toBe("current");
    expect(slotState(1, 1, null)).toBe("current");
  });

  it("marks a character already drawn as completed", () => {
    expect(slotState(0, 1, snapshot)).toBe("completed");
  });

  it("treats a drawn snapshot as completed even before the cursor moves", () => {
    expect(slotState(0, 0, snapshot)).toBe("current");
    expect(slotState(0, 2, snapshot)).toBe("completed");
  });

  it("marks characters not yet reached as upcoming", () => {
    expect(slotState(1, 0, null)).toBe("upcoming");
    expect(slotState(2, 1, null)).toBe("upcoming");
  });
});
