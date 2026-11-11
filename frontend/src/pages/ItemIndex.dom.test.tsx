import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StudyItem } from "../api/types.ts";
import { studyItem } from "../test/studyItemFixture.ts";
import { ItemIndex } from "./ItemIndex.tsx";

const TOTAL = 137;
const WORDS = ["學", "習", "字", "書", "水", "火", "山", "人"];

function pageItems(offset: number, limit: number, total: number): StudyItem[] {
  const length = Math.max(0, Math.min(limit, total - offset));
  return Array.from({ length }, (_, index) => {
    const id = offset + index + 1;
    return studyItem({
      id,
      entry: {
        ...studyItem().entry,
        id: 1000 + id,
        simplified: WORDS[(id - 1) % WORDS.length],
        pinyin: `ci${id}`,
      },
    });
  });
}

const fetchCalls: URL[] = [];

function serve(total = TOTAL) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const url = new URL(input, "http://localhost");
      fetchCalls.push(url);
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const limit = Number(url.searchParams.get("limit") ?? 20);
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          items: pageItems(offset, limit, total),
          total,
          limit,
          offset,
        }),
      };
    }),
  );
}

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

function lastFetch(): URL {
  return fetchCalls[fetchCalls.length - 1];
}

function DetailProbe() {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  return <p>Detalhe {from}</p>;
}

function renderIndex(initialEntry = "/biblioteca", withDetail = false) {
  const routes = [
    { path: "/biblioteca", element: <ItemIndex /> },
    ...(withDetail ? [{ path: "/biblioteca/itens/:id", element: <DetailProbe /> }] : []),
  ];
  const router = createMemoryRouter(routes, {
    initialEntries: [initialEntry],
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

beforeEach(() => {
  fetchCalls.length = 0;
  stubViewport(true);
  serve();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("desktop item index", () => {
  it("renders the dense table from the first server page with the exact total", async () => {
    renderIndex();

    expect(screen.getByRole("status").textContent).toContain("Carregando itens");
    expect(await screen.findByText("Mostrando 24 de 137")).toBeTruthy();
    const table = screen.getByRole("table");
    expect(within(table).getAllByText("學").length).toBeGreaterThan(0);
    expect(within(table).getAllByText("習").length).toBeGreaterThan(0);
    expect(screen.getByRole("navigation", { name: "Paginação" })).toBeTruthy();
  });

  it("narrows by a filter chip and returns to the first page", async () => {
    const user = userEvent.setup();
    const router = renderIndex("/biblioteca?page=3");
    await screen.findByText("Mostrando 72 de 137");

    await user.click(screen.getByRole("button", { name: "HSK 1" }));

    expect(router.state.location.search).toContain("hsk_level=1");
    expect(router.state.location.search).not.toContain("page=3");
    await waitFor(() => expect(lastFetch().searchParams.get("hsk_level")).toBe("1"));
    expect(lastFetch().searchParams.get("offset") ?? "0").toBe("0");
  });

  it("sends the state, part-of-speech and text filters to the server", async () => {
    const user = userEvent.setup();
    renderIndex();
    await screen.findByText("Mostrando 24 de 137");

    await user.click(screen.getByRole("button", { name: "Em revisão" }));
    await user.click(screen.getByRole("button", { name: "verbo" }));
    await user.type(screen.getByLabelText("Buscar"), "xue");

    await waitFor(() => {
      const params = lastFetch().searchParams;
      expect(params.getAll("state")).toEqual(["review"]);
      expect(params.getAll("pos_tag")).toEqual(["v"]);
      expect(params.get("search")).toBe("xue");
    });
  });

  it("sends the chosen sort to the server", async () => {
    const user = userEvent.setup();
    const router = renderIndex();
    await screen.findByText("Mostrando 24 de 137");

    await user.selectOptions(screen.getByLabelText("Ordenar por"), "created_desc");

    expect(router.state.location.search).toContain("sort=created_desc");
    await waitFor(() => expect(lastFetch().searchParams.get("sort")).toBe("created_desc"));
  });

  it("pages the server list with the numbered pager", async () => {
    const user = userEvent.setup();
    const router = renderIndex();
    await screen.findByText("Mostrando 24 de 137");

    await user.click(screen.getByRole("button", { name: "Próxima página" }));

    expect(router.state.location.search).toContain("page=2");
    await waitFor(() => expect(lastFetch().searchParams.get("offset")).toBe("24"));
    expect(await screen.findByText("Mostrando 48 de 137")).toBeTruthy();
  });

  it("sends a typed due range as local-day instants", async () => {
    const user = userEvent.setup();
    renderIndex();
    await screen.findByText("Mostrando 24 de 137");

    await user.type(screen.getByLabelText("Vence a partir de"), "2026-10-01");

    await waitFor(() =>
      expect(lastFetch().searchParams.get("due_from")).toBe(new Date(2026, 9, 1).toISOString()),
    );
  });

  it("clears a pending search when the filters are cleared", async () => {
    const user = userEvent.setup();
    const router = renderIndex();
    await screen.findByText("Mostrando 24 de 137");

    await user.type(screen.getByLabelText("Buscar"), "xue");
    await user.click(screen.getByRole("button", { name: "HSK 1" }));
    await user.click(screen.getByRole("button", { name: "Limpar filtros" }));
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(router.state.location.search).toBe("");
    expect((screen.getByLabelText("Buscar") as HTMLInputElement).value).toBe("");
  });

  it("returns to the same list position after a detail detour", async () => {
    const user = userEvent.setup();
    const router = renderIndex("/biblioteca?hsk_level=1&sort=created_desc", true);
    await screen.findByRole("table");

    await user.click(screen.getAllByRole("link", { name: /學/ })[0]);
    expect(router.state.location.pathname).toBe("/biblioteca/itens/1");
    expect(screen.getByText(/Detalhe \/biblioteca\?hsk_level=1&sort=created_desc/)).toBeTruthy();

    await router.navigate(-1);

    expect(router.state.location.search).toBe("?hsk_level=1&sort=created_desc");
    expect(await screen.findByRole("table")).toBeTruthy();
  });

  it("explains a page past the end and offers the last page", async () => {
    const user = userEvent.setup();
    const router = renderIndex("/biblioteca?page=99");

    expect(await screen.findByText("Esta página está além do fim da lista")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Ir para a última página" }));

    expect(router.state.location.search).toContain("page=6");
    expect(await screen.findByRole("table")).toBeTruthy();
  });
});

describe("mobile item index", () => {
  it("uses the load-more footer over the same server pages", async () => {
    const user = userEvent.setup();
    stubViewport(false);
    const router = renderIndex();
    await screen.findByText("Mostrando 24 de 137");
    expect(screen.queryByRole("navigation", { name: "Paginação" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Carregar mais" }));

    expect(router.state.location.search).toContain("shown=48");
    await waitFor(() =>
      expect(fetchCalls.some((url) => url.searchParams.get("offset") === "24")).toBe(true),
    );
    expect(await screen.findByText("Mostrando 48 de 137")).toBeTruthy();
  });
});

describe("item index panel states", () => {
  it("shows an empty state when the filtered set is empty", async () => {
    serve(0);
    renderIndex();

    expect(await screen.findByText("Nenhum item encontrado")).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows an error state with a retry that recovers", async () => {
    let failing = true;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        if (failing) throw new Error("rede fora");
        const url = new URL(input, "http://localhost");
        fetchCalls.push(url);
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({
            items: pageItems(0, 24, TOTAL),
            total: TOTAL,
            limit: 24,
            offset: 0,
          }),
        };
      }),
    );
    const user = userEvent.setup();
    renderIndex();

    expect(await screen.findByRole("alert")).toBeTruthy();
    failing = false;
    await user.click(screen.getByRole("button", { name: "Tentar novamente" }));

    expect(await screen.findByRole("table")).toBeTruthy();
  });
});
