import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { StudyItem } from "../api/types.ts";
import { PRIORITY_CONFLICT_MESSAGE, lessonQueueRows } from "../lib/lessonQueue.ts";
import { studyItem } from "../test/studyItemFixture.ts";
import { LessonQueueView } from "./LessonQueuePanel.tsx";

function item(id: number, simplified: string, priority: number | null): StudyItem {
  const base = studyItem({ id, priority_position: priority, card: { state: "learning" } });
  return { ...base, entry: { ...base.entry, simplified } };
}

function render(
  items: StudyItem[],
  overrides: Partial<Parameters<typeof LessonQueueView>[0]> = {},
): string {
  const props: Parameters<typeof LessonQueueView>[0] = {
    rows: lessonQueueRows(items),
    pending: false,
    error: null,
    onFront: () => {},
    onBack: () => {},
    onRemove: () => {},
    ...overrides,
  };
  return renderToStaticMarkup(
    <MemoryRouter>
      <LessonQueueView {...props} />
    </MemoryRouter>,
  );
}

describe("LessonQueueView", () => {
  it("renders an ordered list with contiguous ordinals and no raw positions", () => {
    const html = render([item(1, "甲", null), item(2, "乙", 42), item(3, "丙", -7)]);

    expect(html).toContain("<ol");
    expect(html).toContain('aria-label="Fila de lições"');
    expect(html).toContain(">1</span>");
    expect(html).toContain(">2</span>");
    expect(html).toContain(">3</span>");
    expect(html).not.toContain(">42<");
    expect(html).not.toContain(">-7<");
  });

  it("orders pinned rows first and exposes remove only on pinned rows", () => {
    const html = render([item(1, "甲", null), item(2, "乙", 0), item(3, "丙", null)]);

    expect(html.indexOf("乙")).toBeLessThan(html.indexOf("甲"));
    expect(html.match(/Remover prioridade/g)).toHaveLength(1);
    expect(html).toContain("Remover prioridade de 乙");
    expect(html).not.toContain("Remover prioridade de 甲");
  });

  it("scopes every action name to its own item", () => {
    const html = render([item(1, "甲", null), item(2, "乙", 0)]);

    expect(html).toContain("Fixar 甲 no início das lições");
    expect(html).toContain("Fixar 甲 no fim das lições");
    expect(html).toContain("Fixar 乙 no início das lições");
    expect(html).toContain("Fixar 乙 no fim das lições");
  });

  it("renders an inline alert region and marks the list busy while pending", () => {
    const html = render([item(1, "甲", 0)], {
      pending: true,
      error: PRIORITY_CONFLICT_MESSAGE,
    });

    expect(html).toContain('role="alert"');
    expect(html).toContain(PRIORITY_CONFLICT_MESSAGE);
    expect(html).toMatch(/<ol[^>]*aria-busy="true"/);
  });

  it("renders nothing at an empty queue", () => {
    expect(render([])).toBe("");
  });
});
