import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { studyItem } from "../test/studyItemFixture.ts";
import { Quiz } from "./Quiz.tsx";

function render(record?: boolean): string {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Quiz
          items={[studyItem()]}
          mode="review"
          emptyMessage="Nada para praticar neste período."
          record={record}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Quiz", () => {
  it("keeps the review chrome when recording", () => {
    const html = render();
    expect(html).toContain(">Review<");
    expect(html).not.toContain("SRS intact");
  });

  it("labels a recording-off run as practice and shows the SRS-intact chip", () => {
    const html = render(false);
    expect(html).toContain(">Prática<");
    expect(html).toContain("SRS intact");
    expect(html).not.toContain(">Review<");
  });
});
