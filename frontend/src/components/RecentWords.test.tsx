import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { studyItem } from "../test/studyItemFixture.ts";
import { RecentWords } from "./RecentWords.tsx";

function render(items: ReturnType<typeof studyItem>[]): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <RecentWords items={items} />
    </MemoryRouter>,
  );
}

describe("RecentWords", () => {
  it("links each recent word to its detail page and shows its SRS stage chip", () => {
    const items = [
      studyItem({
        id: 7,
        entry: { ...studyItem().entry, simplified: "学", pinyin: "xue2" },
        card: { stability: 30 },
      }),
      studyItem({
        id: 8,
        entry: { ...studyItem().entry, simplified: "老师", pinyin: "lao3 shi1" },
        card: { stability: 1 },
      }),
    ];

    const html = render(items);

    expect(html).toContain('href="/biblioteca/itens/7"');
    expect(html).toContain('href="/biblioteca/itens/8"');
    expect(html).toContain("Journeyman I");
    expect(html).toContain("Novice I");
    expect(html).toContain("学");
  });

  it("has its own empty state before anything is queued", () => {
    const html = render([]);

    expect(html).toContain("Nenhuma palavra recente");
    expect(html).not.toContain("<li");
  });
});
