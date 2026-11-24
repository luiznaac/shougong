import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DictionaryMeaning, DictionaryWord, StudyItem } from "../api/types.ts";
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

function meaningAt(index: number): DictionaryMeaning[] {
  const entryId = index * 2 + 1;
  if (index === 0) {
    return [
      { entry_id: entryId, definitions: ["aprender"] },
      { entry_id: entryId + 1, definitions: ["sobrenome Xue"] },
    ];
  }
  return [{ entry_id: entryId, definitions: [`definição ${index + 1}`] }];
}

function wordAt(index: number): DictionaryWord {
  return {
    simplified: WORDS[index],
    pinyin: `ci${index + 1}`,
    hsk_level: index === 0 ? 1 : null,
    pos_tags: [],
    handwriting_level: index === 0 ? 2 : null,
    meanings: meaningAt(index),
  };
}

function pageWords(words: DictionaryWord[], offset: number, limit: number): DictionaryWord[] {
  return words.slice(offset, offset + limit);
}

const fetchCalls: { method: string; url: URL; body?: unknown }[] = [];

function serve({
  queuedEntryIds = [] as number[],
  words = WORDS.map((_, index) => wordAt(index)),
} = {}) {
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
          json: async () => ({
            items: pageWords(words, offset, limit),
            total: words.length,
            limit,
            offset,
          }),
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
  it("pages five word groups at a time and shows the HSK level", async () => {
    serve();
    const user = userEvent.setup();
    renderPanel("desktop");

    await user.type(screen.getByRole("searchbox", { name: "Buscar no dicionário" }), "xue");

    expect(await screen.findByText("Mostrando 5 de 16")).toBeTruthy();
    expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(6);
    expect(within(tableRow("學")).getByText("HSK 1")).toBeTruthy();
    expect(within(tableRow("學")).getByText("escrita HSK 2")).toBeTruthy();
    expect(within(tableRow("習")).getByText("sem HSK")).toBeTruthy();
    expect(within(tableRow("習")).getByText("escrita —")).toBeTruthy();
    expect(screen.getByRole("navigation", { name: "Paginação" })).toBeTruthy();
  });

  it("renders every meaning of a word, each with its own enqueue control", async () => {
    serve();
    const user = userEvent.setup();
    renderPanel("desktop");
    await user.type(screen.getByRole("searchbox", { name: "Buscar no dicionário" }), "xue");
    await screen.findByText("Mostrando 5 de 16");

    const row = tableRow("學");
    expect(within(row).getByText("aprender")).toBeTruthy();
    expect(within(row).getByText("sobrenome Xue")).toBeTruthy();
    expect(within(row).getAllByRole("button", { name: /^Adicionar/ })).toHaveLength(2);
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

  it("enqueues the chosen meaning's entry id and flips only that meaning", async () => {
    serve();
    const user = userEvent.setup();
    renderPanel("desktop");
    await user.type(screen.getByRole("searchbox", { name: "Buscar no dicionário" }), "xue");
    await screen.findByText("Mostrando 5 de 16");

    const row = tableRow("學");
    const enqueueButtons = within(row).getAllByRole("button", { name: /^Adicionar/ });
    await user.click(enqueueButtons[1]);

    expect(await within(row).findByRole("button", { name: /^Adicionado/ })).toBeTruthy();
    const post = fetchCalls.find((call) => call.method === "POST");
    expect(post?.body).toEqual({ dictionary_entry_id: 2 });

    await waitFor(() =>
      expect(within(row).getAllByRole("button", { name: /^Na fila/ })).toHaveLength(1),
    );
    expect(within(row).getAllByRole("button", { name: /^Adicionar/ })).toHaveLength(1);
  });

  it("shows Na fila for a meaning that is already queued", async () => {
    serve({ queuedEntryIds: [2] });
    const user = userEvent.setup();
    renderPanel("desktop");
    await user.type(screen.getByRole("searchbox", { name: "Buscar no dicionário" }), "xue");
    await screen.findByText("Mostrando 5 de 16");

    const row = tableRow("學");
    await waitFor(() =>
      expect(within(row).getAllByRole("button", { name: /^Na fila/ })).toHaveLength(1),
    );
    expect(within(row).getAllByRole("button", { name: /^Adicionar/ })).toHaveLength(1);
    expect(within(tableRow("習")).getByRole("button", { name: /^Adicionar/ })).toBeTruthy();
  });

  it("renders different readings of the same hanzi as separate rows", async () => {
    serve({
      words: [
        { ...wordAt(0), simplified: "和", pinyin: "he2", meanings: meaningAt(0) },
        {
          ...wordAt(1),
          simplified: "和",
          pinyin: "he4",
          meanings: [{ entry_id: 3, definitions: ["cantar em coro"] }],
        },
      ],
    });
    const user = userEvent.setup();
    renderPanel("desktop");
    await user.type(screen.getByRole("searchbox", { name: "Buscar no dicionário" }), "he");

    expect(await screen.findByText("Mostrando 2 de 2")).toBeTruthy();
    const table = screen.getByRole("table");
    expect(within(table).getAllByText("和")).toHaveLength(2);
    expect(within(table).getByText("hé")).toBeTruthy();
    expect(within(table).getByText("hè")).toBeTruthy();
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
