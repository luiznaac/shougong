import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { LearnedProgress } from "../api/types.ts";
import { formatDayLabel } from "../lib/format.ts";
import { ItemsLearnedChart } from "./ItemsLearnedChart.tsx";

const LEARNED: LearnedProgress = {
  total: 6,
  points: [
    { date: "2026-10-14", count: 1 },
    { date: "2026-10-20", count: 2 },
    { date: "2026-11-10", count: 3 },
  ],
};

describe("ItemsLearnedChart", () => {
  it("draws the plot with HTML Y ticks beside it", () => {
    const html = renderToStaticMarkup(<ItemsLearnedChart learned={LEARNED} />);
    expect(html).toContain("<svg");
    expect(html).toContain(">6<");
    expect(html).toContain(">3<");
    expect(html).toContain(">0<");
  });

  it("labels the X axis with readable local dates", () => {
    const html = renderToStaticMarkup(<ItemsLearnedChart learned={LEARNED} />);
    expect(html).toContain(formatDayLabel("2026-10-14"));
    expect(html).toContain(formatDayLabel("2026-11-10"));
  });

  it("is chart-only — no duplicated snapshot table", () => {
    expect(renderToStaticMarkup(<ItemsLearnedChart learned={LEARNED} />)).not.toContain("<table");
  });

  it("shows its own empty state when nothing has been learned yet", () => {
    const html = renderToStaticMarkup(<ItemsLearnedChart learned={{ total: 0, points: [] }} />);
    expect(html).toContain("Nenhum item aprendido ainda.");
  });
});
