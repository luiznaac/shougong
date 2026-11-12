import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { vocabularySummary } from "../test/vocabularyFixture.ts";
import { VocabularyBreakdown } from "./VocabularyBreakdown.tsx";

describe("VocabularyBreakdown", () => {
  it("shows the totals and each class ordered by count", () => {
    const html = renderToStaticMarkup(<VocabularyBreakdown summary={vocabularySummary()} />);

    expect(html).toContain(">12 ");
    expect(html).toContain("palavras");
    expect(html).toContain("10 no HSK");
    expect(html.indexOf("substantivo")).toBeLessThan(html.indexOf("verbo"));
    expect(html).toContain("6");
    expect(html).toContain("4");
    expect(html).toContain("1");
  });

  it("warns about an adjective shortage when the aggregate reports one", () => {
    const html = renderToStaticMarkup(
      <VocabularyBreakdown summary={vocabularySummary({ qualifier_shortage: true })} />,
    );

    expect(html).toContain("Poucos qualificadores");
  });

  it("has its own empty state before anything is queued", () => {
    const html = renderToStaticMarkup(
      <VocabularyBreakdown
        summary={vocabularySummary({
          total: 0,
          categorised: 0,
          by_category: {},
          by_hsk_level: {},
        })}
      />,
    );

    expect(html).toContain("Nenhuma palavra no vocabulário ainda");
    expect(html).not.toContain("<ul");
  });

  it("says so when words are queued but no class was identified", () => {
    const html = renderToStaticMarkup(
      <VocabularyBreakdown
        summary={vocabularySummary({ total: 4, categorised: 0, by_category: {} })}
      />,
    );

    expect(html).toContain("Nenhuma classe gramatical identificada");
    expect(html).not.toContain("<ul");
  });
});
