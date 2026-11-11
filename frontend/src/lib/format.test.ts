import { describe, expect, it } from "vitest";
import { formatDayLabel, formatWeekdayLabel } from "./format.ts";

describe("local calendar-day labels", () => {
  it("formats a YYYY-MM-DD day in the learner's own calendar, not UTC", () => {
    const label = formatDayLabel("2026-11-12");
    expect(label).toContain("12");
    expect(label).toContain("nov");
  });

  it("formats the weekday of that same local day", () => {
    expect(formatWeekdayLabel("2026-11-12")).toBe(
      new Date(2026, 10, 12).toLocaleDateString("pt-BR", { weekday: "short" }),
    );
  });
});
