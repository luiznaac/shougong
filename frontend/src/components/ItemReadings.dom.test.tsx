import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReadingSummary, SavedReadingText } from "../api/types.ts";
import { ItemReadings } from "./ItemReadings.tsx";

const summaries: ReadingSummary[] = [
  {
    id: 204,
    format: "dialogue",
    topic: "No restaurante",
    topic_generated: false,
    model: "openai/gpt-4.1-mini",
    extra_word_count: 1,
    token_count: 96,
    attempt_count: 2,
    created_at: "2026-11-02T19:12:00Z",
    preview: "服务员：这个菜很辣。我：知道了，谢谢！",
    match: { before: "服务员：这个菜很辣。我：", hit: "知道", after: "了，谢谢！" },
  },
  {
    id: 205,
    format: "paragraph",
    topic: null,
    topic_generated: true,
    model: "anthropic/claude-haiku",
    extra_word_count: 0,
    token_count: 42,
    attempt_count: 1,
    created_at: "2026-10-30T10:00:00Z",
    preview: "我知道你家。",
    match: { before: "", hit: "知道", after: "你家。" },
  },
];

const fullReadings: Record<number, SavedReadingText> = {
  204: {
    id: 204,
    format: "dialogue",
    max_extra_words: 2,
    max_attempts: 3,
    model: "openai/gpt-4.1-mini",
    topic: "No restaurante",
    topic_generated: false,
    tokens: [],
    known_word_count: 120,
    attempts: [],
    attempt_count: 2,
    extra_words: ["服务员"],
    prompt_tokens: 300,
    completion_tokens: 96,
    working_set: {},
    must_use: [],
    speakers: [],
    created_at: "2026-11-02T19:12:00Z",
  },
  205: {
    id: 205,
    format: "paragraph",
    max_extra_words: 2,
    max_attempts: 3,
    model: "anthropic/claude-haiku",
    topic: null,
    topic_generated: true,
    tokens: [],
    known_word_count: 120,
    attempts: [],
    attempt_count: 1,
    extra_words: [],
    prompt_tokens: 100,
    completion_tokens: 42,
    working_set: {},
    must_use: [],
    speakers: [],
    created_at: "2026-10-30T10:00:00Z",
  },
};

let requested: string[] = [];

function stubReadings() {
  requested = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(input.toString(), "http://localhost");
      requested.push(`${url.pathname}${url.search}`);
      if (url.pathname === "/api/reading-texts") {
        const body = {
          items: summaries,
          total: summaries.length,
          limit: 20,
          offset: 0,
        };
        return { ok: true, status: 200, json: async () => body } as Response;
      }
      const id = Number(url.pathname.split("/").at(-1));
      return {
        ok: true,
        status: 200,
        json: async () => fullReadings[id],
      } as Response;
    }),
  );
}

function renderPane(layout: "desktop" | "mobile") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ItemReadings entryId={10} word="知道" layout={layout} />
    </QueryClientProvider>,
  );
}

beforeEach(stubReadings);
afterEach(() => vi.unstubAllGlobals());

describe("ItemReadings", () => {
  it("lists only the entry-filtered summaries and fetches no full reading up front", async () => {
    renderPane("desktop");

    expect(await screen.findByText("No restaurante")).toBeTruthy();
    expect(screen.getByText("Diálogo")).toBeTruthy();
    expect(screen.getByText("openai/gpt-4.1-mini")).toBeTruthy();
    expect(screen.getByText("+1")).toBeTruthy();
    expect(screen.getByText("服务员：这个菜很辣。我：知道了，谢谢！")).toBeTruthy();
    expect(screen.getByText("Mostrando 2 de 2")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Carregar mais" })).toBeNull();

    expect(requested.some((path) => path.includes("entry_id=10"))).toBe(true);
    expect(requested.some((path) => /\/api\/reading-texts\/\d+/.test(path))).toBe(false);
  });

  it("loads the full reading when a row is selected", async () => {
    const user = userEvent.setup();
    renderPane("desktop");

    await screen.findByText("No restaurante");
    await user.click(screen.getByRole("button", { name: /我知道你家/ }));

    await waitFor(() =>
      expect(requested.some((path) => path.startsWith("/api/reading-texts/205"))).toBe(true),
    );
    expect(await screen.findByText(/só vocabulário conhecido/)).toBeTruthy();
    expect(screen.getAllByText("anthropic/claude-haiku").length).toBeGreaterThan(0);
  });

  it("shows the match snippet without inventing an ellipsis at the article edge", async () => {
    const user = userEvent.setup();
    renderPane("desktop");

    await screen.findByText("No restaurante");
    await user.click(screen.getByRole("button", { name: /我知道你家/ }));

    const detail = await screen.findByRole("region", { name: "Leitura selecionada" });
    expect(detail.textContent?.startsWith("知道")).toBe(true);
    expect(within(detail).getByText("知道").tagName).toBe("MARK");
  });

  it("expands the detail inline under the tapped row on mobile", async () => {
    const user = userEvent.setup();
    renderPane("mobile");

    await screen.findByText("No restaurante");
    expect(screen.queryByRole("region", { name: "Leitura selecionada" })).toBeNull();

    await user.click(screen.getByRole("button", { name: /服务员/ }));
    const detail = await screen.findByRole("region", { name: "Leitura selecionada" });
    expect(detail.closest("li")?.textContent).toContain("No restaurante");

    await user.click(screen.getByRole("button", { name: /服务员/ }));
    expect(screen.queryByRole("region", { name: "Leitura selecionada" })).toBeNull();
  });
});
