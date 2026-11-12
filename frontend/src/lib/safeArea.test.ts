import { describe, expect, it } from "vitest";
import { STAGE_BOTTOM, STAGE_LEFT, STAGE_RIGHT, STAGE_TOP } from "./safeArea.ts";

describe("safeArea", () => {
  it("carries each stage inset from the shared module", () => {
    for (const [value, inset] of [
      [STAGE_TOP, "safe-area-inset-top"],
      [STAGE_BOTTOM, "safe-area-inset-bottom"],
      [STAGE_LEFT, "safe-area-inset-left"],
      [STAGE_RIGHT, "safe-area-inset-right"],
    ] as const) {
      expect(value).toContain(`env(${inset})`);
      expect(value).toMatch(/^max\(/);
    }
  });
});
