import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FlipCards } from "./FlipCards.tsx";

describe("FlipCards", () => {
  it("keys duplicate glyphs per occurrence and hides every tile", () => {
    const html = renderToStaticMarkup(
      <FlipCards chars={["马", "马", "虎", "虎"]} hidden={true} available={300} />,
    );

    expect(html.match(/>马</g)).toHaveLength(2);
    expect(html.match(/>虎</g)).toHaveLength(2);
    expect(html.match(/>\?</g)).toHaveLength(4);
  });

  it("uses a proportional corner radius so small tiles stay square-ish", () => {
    const html = renderToStaticMarkup(
      <FlipCards chars={["阿", "拉", "伯"]} hidden={false} available={300} />,
    );

    expect(html).toContain("border-radius:15px");
  });
});
