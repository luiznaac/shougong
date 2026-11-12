import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import type { ExtraStudy } from "../api/types.ts";
import { studyItem } from "../test/studyItemFixture.ts";
import { ExtraStudyView } from "./ExtraStudyPanel.tsx";

function data(overrides: Partial<ExtraStudy> = {}): ExtraStudy {
  return {
    from: "2026-10-28T03:00:00.000Z",
    to: "2026-10-31T03:00:00.000Z",
    recent_mistakes: { total: 2, items: [] },
    recently_learned: { total: 1, items: [] },
    ...overrides,
  };
}

function item(id: number, simplified: string) {
  const base = studyItem({ id });
  return { ...base, entry: { ...base.entry, simplified } };
}

function render(overrides: Partial<Parameters<typeof ExtraStudyView>[0]> = {}): string {
  const props: Parameters<typeof ExtraStudyView>[0] = {
    activeBucket: "recent_mistakes",
    data: data(),
    isLoading: false,
    error: null,
    practiceDisabled: true,
    onBucketChange: () => {},
    onPractice: () => {},
    ...overrides,
  };
  const active = props.data?.[props.activeBucket];
  return renderToStaticMarkup(
    <MemoryRouter>
      <ExtraStudyView {...props} practiceDisabled={(active?.items.length ?? 0) === 0} />
    </MemoryRouter>,
  );
}

describe("ExtraStudyView", () => {
  it("renders both bucket counts before switching", () => {
    const html = render();
    expect(html).toContain("Erros recentes (2)");
    expect(html).toContain("Aprendidos recentemente (1)");
  });

  it("uses tablist/tab/tabpanel roles and marks exactly one tab selected", () => {
    const html = render({ activeBucket: "recently_learned" });
    expect(html).toContain('role="tablist"');
    expect(html.match(/role="tab"/g)).toHaveLength(2);
    expect(html).toContain('role="tabpanel"');
    expect(html.match(/aria-selected="true"/g)).toHaveLength(1);
  });

  it("renders the active bucket's tiles in the received order, capped at four", () => {
    const items = [item(1, "甲"), item(2, "乙"), item(3, "丙"), item(4, "丁"), item(5, "戊")];
    const html = render({ data: data({ recent_mistakes: { total: 5, items } }) });

    expect(html.indexOf("甲")).toBeLessThan(html.indexOf("乙"));
    expect(html).toContain("丁");
    expect(html).not.toContain("戊");
  });

  it("disables Praticar at zero and enables it otherwise", () => {
    const empty = render({ data: data({ recent_mistakes: { total: 0, items: [] } }) });
    const enabled = render({
      data: data({ recent_mistakes: { total: 1, items: [item(9, "甲")] } }),
    });
    expect(empty).toMatch(/<button[^>]*disabled=""[^>]*>Praticar<\/button>/);
    expect(enabled).not.toMatch(/<button[^>]*disabled=""[^>]*>Praticar<\/button>/);
  });

  it("has no date-range inputs — the panel uses the fixed recent window", () => {
    expect(render()).not.toContain("<input");
  });

  it("distinguishes loading from nothing-to-show", () => {
    expect(render({ isLoading: true, data: undefined })).toContain("Carregando estudo extra…");
    const empty = render({ data: data({ recent_mistakes: { total: 0, items: [] } }) });
    expect(empty).toContain("Nenhum erro no período.");
    expect(empty).not.toContain("Carregando estudo extra…");
  });
});
