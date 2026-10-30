import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PRIORITY_CONFLICT_MESSAGE, PRIORITY_HINT } from "../lib/lessonQueue.ts";
import { studyItem } from "../test/studyItemFixture.ts";
import { ItemPrioritySection, ItemPriorityView } from "./ItemPrioritySection.tsx";

function renderView(overrides: Partial<Parameters<typeof ItemPriorityView>[0]> = {}): string {
  return renderToStaticMarkup(
    <ItemPriorityView
      item={studyItem({ priority_position: null })}
      pending={false}
      error={null}
      onFront={() => {}}
      onBack={() => {}}
      onRemove={() => {}}
      {...overrides}
    />,
  );
}

function renderSection(item: Parameters<typeof ItemPrioritySection>[0]["item"]): string {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return renderToStaticMarkup(
    <QueryClientProvider client={client}>
      <ItemPrioritySection item={item} />
    </QueryClientProvider>,
  );
}

describe("ItemPrioritySection", () => {
  it("renders only for items still learning", () => {
    expect(renderSection(studyItem({ card: { state: "learning" } }))).toContain("Prioridade");
    expect(renderSection(studyItem({ card: { state: "review" } }))).toBe("");
    expect(renderSection(studyItem({ card: { state: "relearning" } }))).toBe("");
  });
});

describe("ItemPriorityView", () => {
  it("shows the status, the hint and all three actions", () => {
    const html = renderView();

    expect(html).toContain("Sem prioridade");
    expect(html).toContain(PRIORITY_HINT);
    expect(html).toContain("Fixar 學 no início das lições");
    expect(html).toContain("Fixar 學 no fim das lições");
    expect(html).toContain("Remover prioridade de 學");
  });

  it("reports an active priority and enables remove only when pinned", () => {
    const unpinned = renderView();
    const pinned = renderView({ item: studyItem({ priority_position: 0 }) });

    expect(pinned).toContain("Prioridade ativa");
    expect(unpinned).toMatch(/<button[^>]*disabled=""[^>]*>Remover<\/button>/);
    expect(pinned).not.toMatch(/<button[^>]*disabled=""[^>]*>Remover<\/button>/);
  });

  it("shows failures as inline alert text", () => {
    const html = renderView({ error: PRIORITY_CONFLICT_MESSAGE });

    expect(html).toContain('role="alert"');
    expect(html).toContain(PRIORITY_CONFLICT_MESSAGE);
  });
});
