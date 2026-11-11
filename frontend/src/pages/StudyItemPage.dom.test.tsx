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
});

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
});
