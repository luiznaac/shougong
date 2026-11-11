import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { SrsGroup } from "../lib/srs.ts";
import { SrsHalfPie } from "./SrsHalfPie.tsx";

function tally(overrides: Partial<Record<SrsGroup, number>> = {}): Record<SrsGroup, number> {
  return {
    novice: 0,
    apprentice: 0,
    journeyman: 0,
    expert: 0,
    master: 0,
    ...overrides,
  };
}

describe("SrsHalfPie", () => {
  it("renders all five display groups with their counts and the total in the centre", () => {
    const html = renderToStaticMarkup(
      <SrsHalfPie tally={tally({ novice: 3, apprentice: 2, expert: 1 })} />,
    );

    for (const label of ["Novice", "Apprentice", "Journeyman", "Expert", "Master"]) {
      expect(html).toContain(label);
    }
    expect(html).toContain(">3<");
    expect(html).toContain(">2<");
    expect(html).toContain(">1<");
    expect(html).toContain(">6<");
  });

  it("renders a track and one arc per non-empty group", () => {
    const html = renderToStaticMarkup(
      <SrsHalfPie tally={tally({ novice: 3, apprentice: 2, expert: 1 })} />,
    );
    expect(html.match(/<path/g)).toHaveLength(4);
  });

  it("renders an empty ring at zero — the track only, with zero counts", () => {
    const html = renderToStaticMarkup(<SrsHalfPie tally={tally()} />);

    expect(html.match(/<path/g)).toHaveLength(1);
    expect(html).toContain(">0<");
    expect(html).not.toContain(">1<");
  });
});
