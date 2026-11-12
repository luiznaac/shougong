import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { studyItem } from "../test/studyItemFixture.ts";
import { CsvImportPanel } from "./CsvImportPanel.tsx";

const fetchCalls: { method: string; url: URL; body?: unknown }[] = [];

interface BatchCallOptions {
  statusForRow?: (hanzi: string) => "created" | "skipped" | "error";
  candidatesForRow?: (hanzi: string) => { id: number; simplified: string; pinyin: string }[];
  holdFirstResponse?: boolean;
}

function serve(options: BatchCallOptions = {}) {
  let releaseFirst: (() => void) | undefined;
  let firstHeld = false;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string, init?: RequestInit) => {
      const url = new URL(input, "http://localhost");
      const method = init?.method ?? "GET";
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
      fetchCalls.push({ method, url, body });

      if (url.pathname === "/api/study-items/batch" && method === "POST") {
        const row = body.rows[0] as { hanzi: string; pinyin: string };
        const status = options.statusForRow?.(row.hanzi) ?? "created";
        const candidates = options.candidatesForRow?.(row.hanzi) ?? [];
        const response = {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({
            created: status === "created" ? 1 : 0,
            skipped: status === "skipped" ? 1 : 0,
            errors: status === "error" ? 1 : 0,
            outcomes: [
              {
                row: 1,
                hanzi: row.hanzi,
                pinyin: row.pinyin,
                status,
                study_item_id: status === "created" ? 100 : null,
                detail: status === "error" ? "mais de uma entrada corresponde" : null,
                candidates: candidates.map((candidate) => ({
                  definitions: ["significado"],
                  hsk_level: null,
                  pos_tags: [],
                  ...candidate,
                })),
              },
            ],
          }),
        };
        if (options.holdFirstResponse && !firstHeld) {
          firstHeld = true;
          return new Promise((resolve) => {
            releaseFirst = () => resolve(response);
          });
        }
        return response;
      }

      if (url.pathname === "/api/study-items" && method === "POST") {
        return {
          ok: true,
          status: 201,
          statusText: "Created",
          json: async () => studyItem({ id: 200 }),
        };
      }

      if (url.pathname.endsWith("/overview")) {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({}),
        };
      }

      if (url.pathname === "/api/study-items") {
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({ items: [], total: 0, limit: 100, offset: 0 }),
        };
      }

      throw new Error(`unexpected request ${method} ${url.pathname}`);
    }),
  );
  return () => releaseFirst?.();
}

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <CsvImportPanel />
    </QueryClientProvider>,
  );
}

function csvWith(rows: number): string {
  return Array.from({ length: rows }, (_, index) => `字${index + 1},ci${index + 1}`).join("\n");
}

function resultTable(): HTMLElement {
  return screen.getByRole("table");
}

beforeEach(() => {
  fetchCalls.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CSV import panel", () => {
  it("shows the file chip for a chosen CSV", async () => {
    serve();
    const user = userEvent.setup();
    renderPanel();

    await user.upload(
      screen.getByLabelText("Arquivo CSV"),
      new File([csvWith(2)], "itens.csv", { type: "text/csv" }),
    );

    expect(await screen.findByText("itens.csv")).toBeTruthy();
    expect(screen.getByText("2 linhas reconhecidas")).toBeTruthy();
  });

  it("shows live progress and the created/skipped/error summary tiles", async () => {
    const release = serve({
      statusForRow: (hanzi) => (hanzi === "字2" ? "skipped" : "created"),
      holdFirstResponse: true,
    });
    const user = userEvent.setup();
    renderPanel();
    await user.type(screen.getByLabelText("Conteúdo do CSV"), csvWith(2));

    await user.click(screen.getByRole("button", { name: "Importar" }));

    expect(await screen.findByText(/Importando… 0 de 2/)).toBeTruthy();
    release();

    expect(await screen.findByLabelText("criadas: 1")).toBeTruthy();
    expect(screen.getByLabelText("puladas: 1")).toBeTruthy();
    expect(screen.getByLabelText("com erro: 0")).toBeTruthy();
    await waitFor(() => expect(screen.getByLabelText("criadas: 1")).toBeTruthy());
  });

  it("pages the per-row results twelve at a time", async () => {
    serve();
    const user = userEvent.setup();
    renderPanel();
    await user.type(screen.getByLabelText("Conteúdo do CSV"), csvWith(13));

    await user.click(screen.getByRole("button", { name: "Importar" }));

    expect(await screen.findByText("Mostrando 12 de 13")).toBeTruthy();
    expect(within(resultTable()).getAllByText("criada")).toHaveLength(12);

    await user.click(screen.getByRole("button", { name: "Próxima página" }));

    expect(await screen.findByText("Mostrando 13 de 13")).toBeTruthy();
    expect(within(resultTable()).getAllByText("criada")).toHaveLength(1);
  });

  it("resolves an ambiguous row inline without restarting the batch", async () => {
    serve({
      statusForRow: (hanzi) => (hanzi === "字1" ? "error" : "created"),
      candidatesForRow: (hanzi) =>
        hanzi === "字1"
          ? [
              { id: 71, simplified: "字", pinyin: "zi4" },
              { id: 72, simplified: "自", pinyin: "zi4" },
            ]
          : [],
    });
    const user = userEvent.setup();
    renderPanel();
    await user.type(screen.getByLabelText("Conteúdo do CSV"), csvWith(2));

    await user.click(screen.getByRole("button", { name: "Importar" }));

    const pick = await screen.findByRole("button", { name: /#71 zi4/ });
    await user.click(pick);

    await waitFor(() =>
      expect(
        fetchCalls.some(
          (call) => call.method === "POST" && call.url.pathname === "/api/study-items",
        ),
      ).toBe(true),
    );
    expect(
      fetchCalls.filter((call) => call.url.pathname === "/api/study-items/batch"),
    ).toHaveLength(2);
    await waitFor(() => expect(within(resultTable()).getAllByText("criada")).toHaveLength(2));
    expect(within(resultTable()).queryByText("erro")).toBeNull();
  });
});
