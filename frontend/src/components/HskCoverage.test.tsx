import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HskCoverage } from "./HskCoverage.tsx";

describe("HskCoverage", () => {
  it("renders one ordered bar per HSK level with its coverage and known count", () => {
    const html = renderToStaticMarkup(
      <HskCoverage
        rows={[
          { level: 1, known: 4, coverage: 0.8 },
          { level: 2, known: 3, coverage: 0.5 },
        ]}
      />,
    );

    expect(html.indexOf("HSK 1")).toBeLessThan(html.indexOf("HSK 2"));
    expect(html).toContain("80%");
    expect(html).toContain("50%");
    expect(html).toContain("(4)");
    expect(html.match(/<li/g)).toHaveLength(2);
  });

  it("explains that coverage needs the HSK totals when there are no rows", () => {
    const html = renderToStaticMarkup(<HskCoverage rows={[]} />);

    expect(html).toContain("Cobertura HSK indisponível");
    expect(html).toContain("níveis HSK");
  });
});
