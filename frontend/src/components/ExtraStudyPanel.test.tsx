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
    range: { from: "2026-10-28", to: "2026-10-30" },
    bounds: { min: "2026-10-01", max: "2026-10-30" },
    activeBucket: "recent_mistakes",
    data: data(),
    isLoading: false,
    error: null,
    practiceDisabled: false,
    onFromChange: () => {},
    onToChange: () => {},
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
  it("renders both tab counts before switching", () => {
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
    expect(html).toContain('aria-selected="true"');
  });

  it("renders the active bucket's tiles in the received order", () => {
    const items = [item(9, "甲"), item(3, "乙")];
    const html = render({ data: data({ recent_mistakes: { total: 2, items } }) });
    expect(html.indexOf("甲")).toBeLessThan(html.indexOf("乙"));
  });

  it("disables Praticar at zero and enables it otherwise", () => {
    const empty = render({ data: data({ recent_mistakes: { total: 0, items: [] } }) });
    const enabled = render({
      data: data({ recent_mistakes: { total: 1, items: [item(9, "甲")] } }),
    });
    expect(empty).toMatch(/<button[^>]*disabled=""[^>]*>Praticar<\/button>/);
    expect(enabled).not.toMatch(/<button[^>]*disabled=""[^>]*>Praticar<\/button>/);
  });

  it("distinguishes loading from nothing-to-show", () => {
    expect(render({ isLoading: true, data: undefined })).toContain("Carregando estudo extra…");
    const empty = render({ data: data({ recent_mistakes: { total: 0, items: [] } }) });
    expect(empty).toContain("Nenhum erro no período.");
    expect(empty).not.toContain("Carregando estudo extra…");
  });
});
