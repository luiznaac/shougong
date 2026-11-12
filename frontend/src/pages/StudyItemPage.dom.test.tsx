import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { studyItem } from "../test/studyItemFixture.ts";
import { StudyItemPage } from "./StudyItemPage.tsx";

const ITEM = studyItem({ id: 7 });

function ok(body: unknown) {
  return { ok: true, status: 200, statusText: "OK", json: async () => body };
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const url = new URL(input, "http://localhost");
      if (url.pathname === "/api/study-items/7") return ok(ITEM);
      if (url.pathname === "/api/study-items/7/history") return ok([]);
      if (url.pathname === "/api/study-items")
        return ok({ items: [ITEM], total: 1, limit: 100, offset: 0 });
      if (url.pathname === "/api/dictionary-entries/10/related")
        return ok({ items: [], total: 0, limit: 8, offset: 0 });
      if (url.pathname === "/api/reading-texts")
        return ok({ items: [], total: 0, limit: 20, offset: 0 });
      if (url.pathname === "/api/dictionary-entries") {
        return ok({ items: [], total: 0, limit: 25, offset: 0 });
      }
      if (url.pathname.startsWith("/api/characters/")) {
        return ok({ character: "學", strokes: [], medians: [] });
      }
      return ok([]);
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function setDesktopBreakpoint(desktop: boolean) {
  vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: desktop,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }) as unknown as MediaQueryList,
  );
}

function renderPage(initialEntry: string | { pathname: string; state: unknown }) {
  const router = createMemoryRouter(
    [{ path: "/biblioteca/itens/:id", element: <StudyItemPage /> }],
    {
      initialEntries: [initialEntry],
    },
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe("StudyItemPage", () => {
  it("returns to the exact list it came from", async () => {
    renderPage({
      pathname: "/biblioteca/itens/7",
      state: { from: "/biblioteca?hsk_level=2&page=3" },
    });

    const back = await screen.findByRole("link", { name: "← Biblioteca" });

    expect(back.getAttribute("href")).toBe("/biblioteca?hsk_level=2&page=3");
    expect(screen.getByText("Journeyman I")).toBeTruthy();
  });

  it("falls back to the Biblioteca index without a stored origin", async () => {
    renderPage("/biblioteca/itens/7");

    const back = await screen.findByRole("link", { name: "← Biblioteca" });

    expect(back.getAttribute("href")).toBe("/biblioteca");
  });

  it("leads with the identity and plain-language FSRS facts", async () => {
    renderPage("/biblioteca/itens/7");

    expect(await screen.findByRole("heading", { name: "estudar" })).toBeTruthy();
    for (const label of [
      "Estado",
      "Próxima revisão",
      "Estabilidade",
      "Dificuldade",
      "Último review",
      "Adicionado",
    ]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getAllByText("Em revisão").length).toBeGreaterThan(0);
    expect(screen.getByText("30.0 dias")).toBeTruthy();
  });

  it("puts the open stroke card first among the mobile study panels", async () => {
    renderPage("/biblioteca/itens/7");

    const headings = [
      await screen.findByRole("heading", { name: "Ordem dos traços" }),
      screen.getByRole("heading", { name: "Trajetória" }),
      screen.getByRole("heading", { name: /Leituras com/ }),
      screen.getByRole("heading", { name: "Relacionados" }),
    ];

    for (let index = 1; index < headings.length; index += 1) {
      expect(
        headings[index - 1].compareDocumentPosition(headings[index]) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it("keeps only the stroke player in the desktop rail after the main column", async () => {
    setDesktopBreakpoint(true);
    renderPage("/biblioteca/itens/7");

    const trajectory = await screen.findByRole("heading", { name: "Trajetória" });
    const readings = screen.getByRole("heading", { name: /Leituras com/ });
    const related = screen.getByRole("heading", { name: "Relacionados" });
    const strokes = screen.getByRole("heading", { name: "Ordem dos traços" });

    expect(
      trajectory.compareDocumentPosition(readings) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      readings.compareDocumentPosition(related) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      related.compareDocumentPosition(strokes) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getAllByRole("heading", { name: "Ordem dos traços" })).toHaveLength(1);
  });
});
