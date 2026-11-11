import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { levelColor, levelOf } from "../lib/srs.ts";
import { studyItem } from "../test/studyItemFixture.ts";
import { SrsStageChip } from "./SrsStageChip.tsx";

describe("SrsStageChip", () => {
  it("names the item's SRS stage and paints it with that group's colour", () => {
    const card = studyItem().card;
    const markup = renderToStaticMarkup(<SrsStageChip card={card} />);

    expect(markup).toContain("Journeyman I");
    expect(markup).toContain(levelColor(levelOf(card)));
  });

  it("labels a brand-new card as Novice I", () => {
    const card = studyItem({ card: { stability: 0 } }).card;
    const markup = renderToStaticMarkup(<SrsStageChip card={card} />);

    expect(markup).toContain("Novice I");
    expect(markup).toContain(levelColor(levelOf(card)));
  });
});
