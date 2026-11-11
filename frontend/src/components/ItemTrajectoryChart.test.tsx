import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { StudyItemHistory } from "../api/types.ts";
import { ItemTrajectoryChart } from "./ItemTrajectoryChart.tsx";

function snapshot(createdAt: string, stability: number, difficulty: number): StudyItemHistory {
  return {
    study_item_id: 1,
    entry: {
      id: 10,
      simplified: "學",
      pinyin: "xue2",
      definitions: ["estudar"],
      hsk_level: 1,
      pos_tags: [],
    },
    card: {
      state: "review",
      due: createdAt,
      stability,
      difficulty,
      last_review: createdAt,
    },
    created_at: createdAt,
    is_leech: false,
  };
}

const HISTORY = [
  snapshot("2026-10-30T12:00:00Z", 30, 6),
  snapshot("2026-10-01T12:00:00Z", 10, 4),
  snapshot("2026-10-14T12:00:00Z", 20, 5),
];

const axisDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

describe("ItemTrajectoryChart", () => {
  it("draws both Y axes with readable labels", () => {
    const html = renderToStaticMarkup(<ItemTrajectoryChart history={HISTORY} layout="desktop" />);

    expect(html).toContain("dias");
    expect(html).toContain("Dificuldade (1–10)");
    expect(html).toContain(">30<");
    expect(html).toContain(">15<");
    expect(html).toContain(">10<");
    expect(html).toContain(">5,5<");
    expect(html).toContain(">1<");
    expect(html).toContain(">0<");
  });

  it("labels the X axis with readable dates from oldest to newest", () => {
    const html = renderToStaticMarkup(<ItemTrajectoryChart history={HISTORY} layout="desktop" />);

    expect(html).toContain(axisDate("2026-10-01T12:00:00Z"));
    expect(html).toContain(axisDate("2026-10-30T12:00:00Z"));
  });

  it("is chart-only — no duplicated snapshot list", () => {
    const html = renderToStaticMarkup(<ItemTrajectoryChart history={HISTORY} layout="desktop" />);

    expect(html).toContain("<svg");
    expect(html).not.toContain("<table");
  });

  it("shows its own empty state when there is no history yet", () => {
    const html = renderToStaticMarkup(<ItemTrajectoryChart history={[]} layout="desktop" />);

    expect(html).toContain("Sem histórico ainda.");
    expect(html).not.toContain("<svg");
  });
});
