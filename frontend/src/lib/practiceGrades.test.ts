import { describe, expect, it } from "vitest";
import { PRACTICE_GRADES, gradeByHotkey, gradeConsequence, gradeOf } from "./practiceGrades.ts";

describe("practice grade keys", () => {
  it("keeps the runner's note order and hotkeys", () => {
    expect(PRACTICE_GRADES.map((grade) => grade.key)).toEqual(["again", "hard", "good", "easy"]);
    expect(PRACTICE_GRADES.map((grade) => grade.hotkey)).toEqual(["1", "2", "3", "4"]);
  });

  it("carries the adopted SRS hints and stage-hue bars", () => {
    expect(PRACTICE_GRADES.map((grade) => grade.hint)).toEqual([
      "reaprende agora",
      "volta em ~1 dia",
      "volta em ~3 dias",
      "volta em ~7 dias",
    ]);
    expect(PRACTICE_GRADES.map((grade) => grade.barClass)).toEqual([
      "border-srs-apprentice",
      "border-srs-guru",
      "border-srs-master",
      "border-srs-enlightened",
    ]);
  });

  it("resolves a grade by rating and by hotkey", () => {
    expect(gradeOf("good").label).toBe("Bom");
    expect(gradeByHotkey("3")?.key).toBe("good");
    expect(gradeByHotkey("9")).toBeUndefined();
  });

  it("writes the revealed consequence from the chosen note", () => {
    expect(gradeConsequence("good")).toBe("Bom · volta em ~3 dias");
    expect(gradeConsequence("again")).toBe("Errei · reaprende agora");
  });
});
