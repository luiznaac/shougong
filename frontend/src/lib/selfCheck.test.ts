import { describe, expect, it } from "vitest";
import {
  type SlotCapture,
  afterCharacterComplete,
  revealTarget,
  rollbackStep,
  slotState,
} from "./selfCheck.ts";

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

describe("rollbackStep", () => {
  const base = { drawIdx: 0, count: 3, lesson: false, handwriting: true };

  it("clears a chosen grade and keeps the comparison", () => {
    expect(rollbackStep({ ...base, phase: "revealed", hasGrade: true })).toEqual({
      kind: "clear-grade",
    });
  });

  it("steps back to the last character from the comparison with no grade", () => {
    expect(rollbackStep({ ...base, phase: "revealed", hasGrade: false, drawIdx: 2 })).toEqual({
      kind: "step-back",
      drawIdx: 2,
    });
  });

  it("returns to the start of recall when handwriting is off", () => {
    expect(
      rollbackStep({ ...base, phase: "revealed", hasGrade: false, handwriting: false }),
    ).toEqual({ kind: "step-back", drawIdx: 0 });
  });

  it("returns to the character being drawn from a peek", () => {
    expect(rollbackStep({ ...base, phase: "peek", hasGrade: false, drawIdx: 1 })).toEqual({
      kind: "return-to-recall",
    });
  });

  it("steps back one character during a lesson recall", () => {
    expect(
      rollbackStep({ ...base, phase: "prompt", hasGrade: false, lesson: true, drawIdx: 2 }),
    ).toEqual({ kind: "step-back", drawIdx: 1 });
  });

  it("returns to stroke study at the first lesson character", () => {
    expect(
      rollbackStep({ ...base, phase: "prompt", hasGrade: false, lesson: true, drawIdx: 0 }),
    ).toEqual({ kind: "back-to-info" });
  });

  it("is unavailable from review and practice recall", () => {
    expect(
      rollbackStep({ ...base, phase: "prompt", hasGrade: false, lesson: false, drawIdx: 1 }),
    ).toEqual({ kind: "unavailable" });
  });

  it("is unavailable before recall", () => {
    expect(rollbackStep({ ...base, phase: "info", hasGrade: false })).toEqual({
      kind: "unavailable",
    });
  });
});
