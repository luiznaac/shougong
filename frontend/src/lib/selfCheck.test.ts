import { describe, expect, it } from "vitest";
import { type SlotCapture, afterCharacterComplete, revealTarget, slotState } from "./selfCheck.ts";

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

describe("revealTarget", () => {
  it("peeks at the character being drawn before the last one", () => {
    expect(revealTarget(0, 3)).toBe("peek");
    expect(revealTarget(1, 3)).toBe("peek");
  });

  it("compares the whole word on the last character", () => {
    expect(revealTarget(2, 3)).toBe("whole");
    expect(revealTarget(0, 1)).toBe("whole");
  });
});

describe("afterCharacterComplete", () => {
  it("advances to the next character while the word has more", () => {
    expect(afterCharacterComplete(0, 3, true)).toBe("next");
    expect(afterCharacterComplete(1, 3, false)).toBe("next");
  });

  it("reveals the whole word automatically when auto-reveal is on", () => {
    expect(afterCharacterComplete(2, 3, true)).toBe("revealed");
    expect(afterCharacterComplete(0, 1, true)).toBe("revealed");
  });

  it("waits for the learner's reveal when auto-reveal is off", () => {
    expect(afterCharacterComplete(2, 3, false)).toBe("waiting");
    expect(afterCharacterComplete(0, 1, false)).toBe("waiting");
  });
});
