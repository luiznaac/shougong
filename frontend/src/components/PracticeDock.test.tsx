import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { STAGE_BOTTOM, STAGE_LEFT, STAGE_RIGHT } from "../lib/safeArea.ts";
import { PracticeDock } from "./PracticeDock.tsx";

function markup(presentation: "mobile" | "desktop"): string {
  return renderToStaticMarkup(
    <PracticeDock
      presentation={presentation}
      revealed
      selected={null}
      canRollback={false}
      canNext
      submitting={false}
      nextLabel="Próximo"
      onSelect={vi.fn()}
      onRollback={vi.fn()}
      onNext={vi.fn()}
    />,
  );
}

describe("PracticeDock", () => {
  it("pads the mobile dock from the shared bottom and horizontal inset constants", () => {
    const html = markup("mobile");

    expect(html).toContain(STAGE_BOTTOM);
    expect(html).toContain(STAGE_LEFT);
    expect(html).toContain(STAGE_RIGHT);
  });

  it("leaves the desktop dock without viewport insets", () => {
    expect(markup("desktop")).not.toContain("env(safe-area-inset-");
  });
});
