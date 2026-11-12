import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AddImport } from "./AddImport.tsx";

function stubViewport(desktop: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: desktop && query.includes("min-width: 768px"),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
}

function serve({ overviewError = false } = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const url = new URL(input, "http://localhost");
      if (url.pathname === "/api/study/overview" && overviewError) {
        return {
          ok: false,
          status: 500,
          statusText: "Server Error",
          json: async () => ({ detail: "indisponível" }),
        };
      }
      if (url.pathname === "/api/study/overview") {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({ item_count: 213 }),
        };
      }
      if (url.pathname === "/api/dictionary-entries") {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({ items: [], total: 0, limit: 5, offset: 0 }),
        };
      }
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({ items: [], total: 0, limit: 100, offset: 0 }),
      };
    }),
  );
}

function PathProbe() {
  return <p>{useLocation().pathname}</p>;
}

function renderPage(initialEntry = "/biblioteca/adicionar") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route
            path="/biblioteca/adicionar"
            element={
              <>
                <AddImport />
                <PathProbe />
              </>
            }
          />
          <Route
            path="/biblioteca/importar"
            element={
              <>
                <AddImport />
                <PathProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  serve();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Add/Import workspace", () => {
  it("shows dictionary search and CSV import side by side with one queue counter", async () => {
    stubViewport(true);
    renderPage();

    expect(screen.getByText("Buscar no dicionário")).toBeTruthy();
    expect(screen.getByText("Importar CSV")).toBeTruthy();
    expect(await screen.findByText("213 na fila")).toBeTruthy();
  });

  it("is search-only on mobile and explains where CSV import lives", async () => {
    stubViewport(false);
    renderPage();

    expect(await screen.findByText("213 na fila")).toBeTruthy();
    expect(screen.getByRole("searchbox", { name: "Buscar no dicionário" })).toBeTruthy();
    expect(screen.queryByText("Importar CSV")).toBeNull();
    expect(screen.getByText(/A importação de CSV está disponível apenas no desktop/)).toBeTruthy();
  });

  it("falls back to Adicionar when mobile opens the CSV-only route directly", async () => {
    stubViewport(false);
    renderPage("/biblioteca/importar");

    expect(await screen.findByText("/biblioteca/adicionar")).toBeTruthy();
    expect(screen.queryByText("Importar CSV")).toBeNull();
  });

  it("shows the counter's error state instead of a fake zero queue", async () => {
    serve({ overviewError: true });
    stubViewport(true);
    renderPage();

    expect(await screen.findByText("fila indisponível")).toBeTruthy();
    expect(screen.queryByText("0 na fila")).toBeNull();
  });
});
