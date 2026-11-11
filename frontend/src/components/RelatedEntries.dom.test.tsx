import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RelatedEntry } from "../api/types.ts";
import { RelatedEntries } from "./RelatedEntries.tsx";

const WORDS = ["知道", "知", "知識", "通知", "認識", "知覺", "求知", "知己", "無知", "知足"];

function entry(index: number): RelatedEntry {
  const queued = index === 0;
  return {
    id: 100 + index,
    simplified: WORDS[index],
    pinyin: "zhi1",
    definitions: [`sentido ${index + 1}`],
    hsk_level: 1,
    pos_tags: ["v"],
    study_item_id: queued ? 7 : null,
  };
}

let requested: string[] = [];
let queuedIds = new Set<number>([100]);

function stubRelated() {
  requested = [];
  queuedIds = new Set<number>([100]);
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input.toString(), "http://localhost");
      requested.push(`${init?.method ?? "GET"} ${url.pathname}${url.search}`);

      if (init?.method === "POST" && url.pathname === "/api/study-items") {
        const body = JSON.parse(String(init.body)) as { dictionary_entry_id: number };
        queuedIds.add(body.dictionary_entry_id);
        return {
          ok: true,
          status: 201,
          json: async () => ({ id: 999, entry: entry(1).simplified, card: {}, is_leech: false }),
        } as Response;
      }

      const offset = Number(url.searchParams.get("offset") ?? 0);
      const limit = Number(url.searchParams.get("limit") ?? 8);
      const items = WORDS.slice(offset, offset + limit).map((_, index) => {
        const row = entry(offset + index);
        return queuedIds.has(row.id) ? { ...row, study_item_id: 7 } : row;
      });
      return {
        ok: true,
        status: 200,
        json: async () => ({ items, total: WORDS.length, limit, offset }),
      } as Response;
    }),
  );
}

function renderPane(layout: "desktop" | "mobile") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <RelatedEntries entryId={10} layout={layout} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(stubRelated);
afterEach(() => vi.unstubAllGlobals());

describe("RelatedEntries", () => {
  it("renders the server order and links a queued word to its study item", async () => {
    renderPane("desktop");

    const list = await screen.findByRole("list", { name: "Palavras relacionadas" });
    const words = within(list).getAllByRole("listitem");
    expect(words).toHaveLength(8);
    expect(words[0].textContent).toContain("知道");
    expect(words[1].textContent).toContain("知");

    const link = screen.getByRole("link", { name: /知道/ });
    expect(link.getAttribute("href")).toBe("/biblioteca/itens/7");
    expect(link.textContent).toContain("na fila");
  });

  it("adds an unqueued word inline and flips it to the queue", async () => {
    const user = userEvent.setup();
    renderPane("desktop");

    const add = await screen.findByRole("button", { name: "Adicionar 知" });
    await user.click(add);

    await waitFor(() => expect(requested).toContain("POST /api/study-items"));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Adicionar 知" })).toBeNull());
    await waitFor(() =>
      expect(
        screen.getByRole("list", { name: "Palavras relacionadas" }).querySelectorAll("a"),
      ).toHaveLength(2),
    );
  });

  it("pages the two-up desktop grid at eight words per page", async () => {
    const user = userEvent.setup();
    renderPane("desktop");

    await screen.findByRole("link", { name: /知道/ });
    expect(screen.queryByText("無知")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Página 2" }));

    expect(await screen.findByText("無知")).toBeTruthy();
    expect(screen.getByText("知足")).toBeTruthy();
    expect(requested.some((call) => call.includes("offset=8"))).toBe(true);
  });

  it("grows the mobile list with Carregar mais", async () => {
    const user = userEvent.setup();
    renderPane("mobile");

    await screen.findByRole("link", { name: /知道/ });
    expect(screen.queryByText("無知")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Carregar mais" }));

    expect(await screen.findByText("無知")).toBeTruthy();
    expect(screen.getByText("知足")).toBeTruthy();
  });
});
