import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { STAGE_LEFT, STAGE_RIGHT, STAGE_TOP } from "../lib/safeArea.ts";
import { studyItem } from "../test/studyItemFixture.ts";
import { PracticeBand } from "./PracticeBand.tsx";

function markup(presentation: "mobile" | "desktop"): string {
  return renderToStaticMarkup(
    <PracticeBand
      presentation={presentation}
      item={studyItem()}
      title="Review"
      band="from-slate-800"
      practice={false}
      phase="prompt"
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
      handwritingEnabled={false}
      onHandwritingEnabledChange={vi.fn()}
      tolerancePercent={10}
      onToleranceChange={vi.fn()}
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
});
