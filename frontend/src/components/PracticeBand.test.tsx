import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type { QuizPhase } from "../lib/quizPractice.ts";
import { STAGE_LEFT, STAGE_RIGHT, STAGE_TOP } from "../lib/safeArea.ts";
import { studyItem } from "../test/studyItemFixture.ts";
import { PracticeBand } from "./PracticeBand.tsx";

function markup(
  presentation: "mobile" | "desktop",
  {
    phase = "prompt",
    handwritingEnabled = false,
  }: { phase?: QuizPhase; handwritingEnabled?: boolean } = {},
): string {
  return renderToStaticMarkup(
    <PracticeBand
      presentation={presentation}
      item={studyItem()}
      title="Review"
      band="from-slate-800"
      practice={false}
      phase={phase}
      progress={{
        itemCount: 3,
        grades: [],
        done: 0,
        remaining: 3,
        accuracy: 100,
        showAccuracy: true,
      }}
      playerOn={false}
      onTogglePlayer={vi.fn()}
      canRollback={false}
      onRollback={vi.fn()}
      onExit={vi.fn()}
      handwritingEnabled={handwritingEnabled}
      onHandwritingEnabledChange={vi.fn()}
    />,
  );
}

describe("PracticeBand", () => {
  it("pads the mobile band from the shared top and horizontal inset constants", () => {
    const html = markup("mobile");

    expect(html).toContain(STAGE_TOP);
    expect(html).toContain(STAGE_LEFT);
    expect(html).toContain(STAGE_RIGHT);
  });

  it("leaves the desktop band without viewport insets", () => {
    expect(markup("desktop")).not.toContain("env(safe-area-inset-");
  });

  it("keeps the answer cards at the reveal when handwriting is off", () => {
    const html = markup("desktop", { phase: "revealed" });

    expect(html).toContain("學");
  });

  it("hides the flip cards during the handwriting comparison but keeps pinyin and meaning", () => {
    const html = markup("desktop", { phase: "revealed", handwritingEnabled: true });

    expect(html).not.toContain("學");
    expect(html).not.toContain(">?<");
    expect(html).toContain("estudar");
  });
});
