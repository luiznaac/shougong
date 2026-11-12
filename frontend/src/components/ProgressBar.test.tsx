import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProgressBar } from "./ProgressBar.tsx";

describe("ProgressBar", () => {
  it("renders a proportional fill with the caller's colour", () => {
    const html = renderToStaticMarkup(<ProgressBar value={0.4} className="bg-sky-500" />);

    expect(html).toContain("width:40%");
    expect(html).toContain("bg-sky-500");
  });

  it("clamps values outside the 0..1 range", () => {
    expect(renderToStaticMarkup(<ProgressBar value={2} />)).toContain("width:100%");
    expect(renderToStaticMarkup(<ProgressBar value={-1} />)).toContain("width:0%");
  });
});
