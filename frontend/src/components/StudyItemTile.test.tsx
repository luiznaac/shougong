import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { studyItem } from "../test/studyItemFixture.ts";
import { StudyItemTile } from "./StudyItemTile.tsx";

function render(overrides: Parameters<typeof studyItem>[0] = {}): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <StudyItemTile item={studyItem(overrides)} />
    </MemoryRouter>,
  );
}

describe("StudyItemTile", () => {
  it("links to the item's detail page under Biblioteca", () => {
    expect(render()).toContain('href="/biblioteca/itens/1"');
  });

  it("shows only the hanzi — no pinyin and no meaning", () => {
    const html = render();
    expect(html).toContain("學");
    expect(html).not.toContain("xue2");
    expect(html).not.toContain("estudar");
  });

  it("renders no badge for an ordinary item", () => {
    expect(render()).not.toContain('role="img"');
  });

  it("draws the ghost badge as an inline icon, with its pt-BR name and title", () => {
    const html = render({ is_leech: true });
    expect(html).toContain("<svg");
    expect(html).toContain('aria-label="Sanguessuga"');
    expect(html).toContain('title="Sanguessuga — falhas recorrentes"');
    expect(html).not.toContain("👻");
    expect(html).not.toContain('aria-label="Prioridade"');
  });

  it("draws the bolt badge as an inline icon for a prioritised item", () => {
    const html = render({ priority_position: 0 });
    expect(html).toContain("<svg");
    expect(html).toContain('aria-label="Prioridade"');
    expect(html).toContain('title="Prioridade — fixado na fila de lições"');
    expect(html).not.toContain("⚡");
    expect(html).not.toContain('aria-label="Sanguessuga"');
  });

  it("renders both, ghost first, inside the tile link", () => {
    const html = render({ is_leech: true, priority_position: -1 });
    const link = html.slice(html.indexOf("<a "), html.indexOf("</a>") + 4);
    expect(link).toContain('aria-label="Sanguessuga"');
    expect(link).toContain('aria-label="Prioridade"');
    expect(link.indexOf("Sanguessuga")).toBeLessThan(link.indexOf("Prioridade"));
  });
});
