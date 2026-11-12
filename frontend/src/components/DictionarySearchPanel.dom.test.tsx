import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DictionaryEntry, StudyItem } from "../api/types.ts";
import { studyItem } from "../test/studyItemFixture.ts";
import { DictionarySearchPanel } from "./DictionarySearchPanel.tsx";

const WORDS = [
  "學",
  "習",
  "字",
  "書",
  "水",
  "火",
  "山",
  "人",
  "木",
  "金",
  "土",
  "日",
  "月",
  "天",
  "地",
  "心",
];
const TOTAL = WORDS.length;

function entryAt(index: number): DictionaryEntry {
  const id = index + 1;
  return {
    id,
    simplified: WORDS[index],
    pinyin: `ci${id}`,
    definitions: [`definição ${id}`],
    hsk_level: index === 0 ? 1 : null,
    pos_tags: [],
  };
}

function pageEntries(offset: number, limit: number): DictionaryEntry[] {
  return Array.from({ length: Math.max(0, Math.min(limit, TOTAL - offset)) }, (_, index) =>
    entryAt(offset + index),
  );
}

const fetchCalls: { method: string; url: URL; body?: unknown }[] = [];

function serve({ queuedEntryIds = [] as number[] } = {}) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = new URL(input, "http://localhost");
      const method = init?.method ?? "GET";
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
      fetchCalls.push({ method, url, body });

      if (url.pathname === "/api/dictionary-entries") {
        const offset = Number(url.searchParams.get("offset") ?? 0);
        const limit = Number(url.searchParams.get("limit") ?? 20);
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({ items: pageEntries(offset, limit), total: TOTAL, limit, offset }),
        };
      }

      if (url.pathname === "/api/study-items" && method === "GET") {
        const items: StudyItem[] = queuedEntryIds.map((entryId, index) =>
          studyItem({
            id: index + 1,
            entry: { ...studyItem().entry, id: entryId },
          }),
        );
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({ items, total: items.length, limit: 100, offset: 0 }),
        };
      }

      if (url.pathname === "/api/study-items" && method === "POST") {
        return {
          ok: true,
          status: 201,
          statusText: "Created",
          json: async () =>
            studyItem({ id: 99, entry: { ...studyItem().entry, id: body.dictionary_entry_id } }),
        };
      }

      throw new Error(`unexpected request ${method} ${url.pathname}`);
    }),
  );
}

function renderPanel(presentation: "desktop" | "mobile") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <DictionarySearchPanel presentation={presentation} />
    </QueryClientProvider>,
  );
}

function tableRow(word: string): HTMLElement {
  const table = screen.getByRole("table");
  const cell = within(table).getByText(word);
  const row = cell.closest("tr");
  if (!row) throw new Error(`no row for ${word}`);
  return row;
}

beforeEach(() => {
  fetchCalls.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("dictionary search panel on desktop", () => {
  it("pages five results at a time and shows the HSK level", async () => {
    serve();
    const user = userEvent.setup();
    renderPanel("desktop");

    await user.type(screen.getByRole("searchbox", { name: "Buscar no dicionário" }), "xue");

    expect(await screen.findByText("Mostrando 5 de 16")).toBeTruthy();
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(6);
    expect(within(tableRow("學")).getByText("HSK 1")).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Paginação" })).toBeTruthy();
  });

  it("moves to the next server page", async () => {
    serve();
    const user = userEvent.setup();
    renderPanel("desktop");
    await user.type(screen.getByRole("searchbox", { name: "Buscar no dicionário" }), "xue");
    await screen.findByText("Mostrando 5 de 16");

    await user.click(screen.getByRole("button", { name: "Próxima página" }));

    expect(await screen.findByText("Mostrando 10 de 16")).toBeTruthy();
    expect(fetchCalls.some((call) => call.url.searchParams.get("offset") === "5")).toBe(true);
  });

  it("flips a row from Adicionado to Na fila after enqueueing it", async () => {
    serve();
    const user = userEvent.setup();
    renderPanel("desktop");
    await user.type(screen.getByRole("searchbox", { name: "Buscar no dicionário" }), "xue");
    await screen.findByText("Mostrando 5 de 16");

    await user.click(within(tableRow("學")).getByRole("button", { name: "Adicionar" }));

    const feedback = await within(tableRow("學")).findByRole("button", { name: "Adicionado" });
    expect(feedback).toBeTruthy();
    const post = fetchCalls.find((call) => call.method === "POST");
    expect(post?.body).toEqual({ dictionary_entry_id: 1 });

    expect(await within(tableRow("學")).findByRole("button", { name: "Na fila" })).toBeTruthy();
  });

  it("shows Na fila for a word that is already queued", async () => {
    serve({ queuedEntryIds: [1] });
    const user = userEvent.setup();
    renderPanel("desktop");
    await user.type(screen.getByRole("searchbox", { name: "Buscar no dicionário" }), "xue");
    await screen.findByText("Mostrando 5 de 16");

    await waitFor(() =>
      expect(within(tableRow("學")).getByRole("button")).toHaveProperty("disabled", true),
    );
    expect(within(tableRow("學")).getByRole("button", { name: "Na fila" })).toBeTruthy();
    expect(within(tableRow("習")).getByRole("button", { name: "Adicionar" })).toBeTruthy();
  });

  it("shows an empty state per query", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        const url = new URL(input, "http://localhost");
        if (url.pathname === "/api/study-items") {
          return {
            ok: true,
            status: 200,
            statusText: "OK",
            json: async () => ({ items: [], total: 0, limit: 100, offset: 0 }),
          };
        }
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({ items: [], total: 0, limit: 5, offset: 0 }),
        };
      }),
    );
    const user = userEvent.setup();
    renderPanel("desktop");

    await user.type(screen.getByRole("searchbox", { name: "Buscar no dicionário" }), "zzz");

    expect(await screen.findByText(/Nenhum resultado para “zzz”/)).toBeTruthy();
  });
});

describe("dictionary search panel on mobile", () => {
  it("loads more cards five at a time instead of paging", async () => {
    serve();
    const user = userEvent.setup();
    renderPanel("mobile");
    await user.type(screen.getByRole("searchbox", { name: "Buscar no dicionário" }), "xue");
    await screen.findByText("Mostrando 5 de 16");
    expect(screen.queryByRole("navigation", { name: "Paginação" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Carregar mais" }));

    expect(await screen.findByText("Mostrando 10 de 16")).toBeTruthy();
    expect(fetchCalls.some((call) => call.url.searchParams.get("offset") === "5")).toBe(true);
  });
});
