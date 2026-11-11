import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { DailyDue } from "../api/types.ts";
import { formatWeekdayLabel } from "../lib/format.ts";
import { UpcomingReviews } from "./UpcomingReviews.tsx";

const DAYS: DailyDue[] = [
  { date: "2026-11-12", due: 8 },
  { date: "2026-11-13", due: 0 },
  { date: "2026-11-14", due: 3 },
  { date: "2026-11-15", due: 12 },
  { date: "2026-11-16", due: 1 },
  { date: "2026-11-17", due: 4 },
  { date: "2026-11-18", due: 6 },
];

function render(days: DailyDue[] = DAYS): string {
  return renderToStaticMarkup(<UpcomingReviews days={days} />);
}

describe("UpcomingReviews", () => {
  it("renders exactly the seven local-day rows it receives, in order", () => {
    const html = render();
    const positions = DAYS.map((day) => html.indexOf(formatWeekdayLabel(day.date)));

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(html.match(/<li/g)).toHaveLength(7);
  });

  it("shows each day's count, including a zero day", () => {
    const html = render();
    expect(html).toContain(">8<");
    expect(html).toContain(">0<");
    expect(html).toContain(">12<");
  });

  it("summarises the seven-day total", () => {
    expect(render()).toContain("34");
  });

  it("shows its own empty sentence when nothing is due, keeping the seven rows", () => {
    const html = render(DAYS.map((day) => ({ ...day, due: 0 })));
    expect(html).toContain("Nenhuma revisão nos próximos 7 dias.");
    expect(html.match(/<li/g)).toHaveLength(7);
  });
});
