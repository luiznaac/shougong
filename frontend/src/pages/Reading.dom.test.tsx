import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/client.ts";
import type {
  ReadingSummary,
  ReadingToken,
  SavedReadingText,
  VocabularyOverview,
} from "../api/types.ts";
import { studyItem } from "../test/studyItemFixture.ts";
import { Reading } from "./Reading.tsx";

vi.mock("../api/client.ts", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  api: {
    listReadingHistory: vi.fn(),
    getReading: vi.fn(),
    listReadingModels: vi.fn(),
    generateReading: vi.fn(),
    listAllStudyItems: vi.fn(),
    addStudyItem: vi.fn(),
    getVocabularyProfile: vi.fn(),
    listReadingTopics: vi.fn(),
    addReadingTopic: vi.fn(),
    setReadingTopicActive: vi.fn(),
    deleteReadingTopic: vi.fn(),
  },
}));

const TOKENS: ReadingToken[] = [
  {
    text: "今天",
    is_word: true,
    pinyin: "jin1 tian1",
    definitions: ["hoje"],
    part_of_speech: "noun",
    is_extra: false,
    dictionary_entry_id: 11,
    speaker: null,
  },
  {
    text: "我",
    is_word: true,
    pinyin: "wo3",
    definitions: ["eu"],
    part_of_speech: "pronoun",
    is_extra: true,
    dictionary_entry_id: 12,
    speaker: null,
  },
  {
    text: "喝茶",
    is_word: true,
    pinyin: "he1 cha2",
    definitions: ["beber chá"],
    part_of_speech: "verb",
    is_extra: false,
    dictionary_entry_id: 13,
    speaker: null,
  },
  {
    text: "。",
    is_word: false,
    pinyin: null,
    definitions: [],
    part_of_speech: null,
    is_extra: false,
    dictionary_entry_id: null,
    speaker: null,
  },
];

function summary(id: number): ReadingSummary {
  return {
    id,
    format: id % 2 === 0 ? "dialogue" : "paragraph",
    topic: id === 1 ? "um chá" : null,
    topic_generated: id !== 1,
    model: "model-a",
    extra_word_count: id === 1 ? 1 : 0,
    token_count: 8,
    attempt_count: 1,
    created_at: `2026-11-${String(11 - id).padStart(2, "0")}T12:00:00Z`,
    preview: id === 1 ? "今天我喝茶" : `预演 ${id}`,
    match: null,
  };
}

const SUMMARIES = Array.from({ length: 10 }, (_, i) => summary(i + 1));

function detail(id: number): SavedReadingText {
  return {
    id,
    format: "paragraph",
    max_extra_words: 2,
    max_attempts: 3,
    model: "model-a",
    topic: "um chá",
    topic_generated: false,
    tokens: TOKENS,
    known_word_count: 100,
    attempts: [],
    attempt_count: 1,
    extra_words: ["我"],
    prompt_tokens: 10,
    completion_tokens: 20,
    working_set: {},
    must_use: [],
    speakers: [],
    created_at: "2026-11-10T12:00:00Z",
  };
}

const VOCABULARY: VocabularyOverview = {
  profiles: [],
  summary: {
    total: 0,
    categorised: 0,
    by_category: {},
    by_hsk_level: {},
    qualifier_shortage: false,
    proficiency: { coverage_by_level: {}, estimated_level: 0 },
  },
};

function stubViewport(desktop: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: desktop && query.includes("min-width: 1024px"),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }));
}

function renderReading() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Reading />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

let queued: number[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  queued = [];

  vi.mocked(api.listReadingHistory).mockImplementation(async (limit = 20, offset = 0) => ({
    items: SUMMARIES.slice(offset, offset + limit),
    total: SUMMARIES.length,
    limit,
    offset,
  }));
  vi.mocked(api.getReading).mockImplementation(async (id: number) => detail(id));
  vi.mocked(api.listReadingModels).mockResolvedValue(["model-a", "model-b"]);
  vi.mocked(api.generateReading).mockImplementation(async () => detail(20));
  vi.mocked(api.listAllStudyItems).mockImplementation(async () =>
    queued.map((entryId, index) =>
      studyItem({ id: 900 + index, entry: { ...studyItem().entry, id: entryId } }),
    ),
  );
  vi.mocked(api.addStudyItem).mockImplementation(async (entryId: number) => {
    queued.push(entryId);
    return studyItem({ id: 999, entry: { ...studyItem().entry, id: entryId } });
  });
  vi.mocked(api.getVocabularyProfile).mockResolvedValue(VOCABULARY);
  vi.mocked(api.listReadingTopics).mockResolvedValue([
    { id: 7, scenario: "a lost key", active: true },
  ]);
});

describe("Leitura workspace — desktop", () => {
  it("renders history, article and word inspector as three panes inside the shell", async () => {
    stubViewport(true);
    renderReading();

    await waitFor(() => expect(screen.getByRole("heading", { name: "Histórico" })).toBeTruthy());

    expect(screen.getByRole("heading", { name: "Palavra" })).toBeTruthy();
    expect(await screen.findByRole("navigation", { name: "Paginação" })).toBeTruthy();
    expect(screen.getByText("Nenhuma leitura selecionada")).toBeTruthy();
    expect(screen.getByText("Nenhuma palavra selecionada")).toBeTruthy();

    expect(api.listReadingHistory).toHaveBeenCalledWith(8, 0);
    expect(api.getReading).not.toHaveBeenCalled();
  });

  it("puts every generator control in one wrapping bar", async () => {
    stubViewport(true);
    renderReading();

    const bar = await screen.findByLabelText("Gerador de leitura");
    expect(within(bar).getByRole("combobox", { name: "Formato" })).toBeTruthy();
    expect(within(bar).getByRole("combobox", { name: "Modelo de IA" })).toBeTruthy();
    expect(within(bar).getByRole("spinbutton", { name: "Palavras extras" })).toBeTruthy();
    expect(within(bar).getByRole("spinbutton", { name: "Tentativas" })).toBeTruthy();
    expect(within(bar).getByRole("textbox", { name: "Tópico" })).toBeTruthy();
    expect(within(bar).getByRole("button", { name: "Gerar leitura" })).toBeTruthy();
  });

  it("pages the history inside its rail and lists summaries only", async () => {
    const user = userEvent.setup();
    stubViewport(true);
    renderReading();

    const row = await screen.findByRole("button", { name: "Leitura #1, Parágrafo" });
    expect(within(row).getByText("um chá")).toBeTruthy();
    expect(within(row).getByText("+1 extra")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Página 2" }));

    await waitFor(() => expect(api.listReadingHistory).toHaveBeenCalledWith(8, 8));
    expect(api.getReading).not.toHaveBeenCalled();
  });

  it("loads the summary into the centre and only then fetches the full reading", async () => {
    const user = userEvent.setup();
    stubViewport(true);
    renderReading();

    await user.click(await screen.findByRole("button", { name: "Leitura #1, Parágrafo" }));

    await waitFor(() => expect(api.getReading).toHaveBeenCalledWith(1));
    expect(await screen.findByRole("button", { name: "喝茶" })).toBeTruthy();
    expect(screen.getAllByText("#1").length).toBeGreaterThan(0);
  });

  it("shows the selected word in the inspector and queues it with the Na fila state", async () => {
    const user = userEvent.setup();
    stubViewport(true);
    renderReading();

    await user.click(await screen.findByRole("button", { name: "Leitura #1, Parágrafo" }));
    await waitFor(() => expect(api.getReading).toHaveBeenCalledWith(1));

    await user.click(await screen.findByRole("button", { name: "我" }));

    expect(await screen.findByText("eu")).toBeTruthy();
    expect(screen.getByText("pronome")).toBeTruthy();
    expect(screen.getByText("wǒ")).toBeTruthy();
    expect(screen.getByText("Fora do vocabulário conhecido")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Adicionar ao estudo" }));

    await waitFor(() => expect(api.addStudyItem).toHaveBeenCalledWith(12));
    const queuedButton = await screen.findByRole("button", { name: "Na fila" });
    expect(queuedButton.getAttribute("disabled")).not.toBeNull();
  });

  it("keeps the model choice in the generator bar and persists it", async () => {
    const user = userEvent.setup();
    stubViewport(true);
    localStorage.setItem("reading.model", "model-b");
    renderReading();

    const bar = await screen.findByLabelText("Gerador de leitura");
    const model = within(bar).getByRole("combobox", { name: "Modelo de IA" }) as HTMLSelectElement;
    await waitFor(() => expect(model.value).toBe("model-b"));

    await user.selectOptions(model, "model-a");
    expect(localStorage.getItem("reading.model")).toBe("model-a");

    await user.click(within(bar).getByRole("button", { name: "Gerar leitura" }));

    await waitFor(() =>
      expect(api.generateReading).toHaveBeenCalledWith(
        expect.objectContaining({ model: "model-a", format: "paragraph" }),
      ),
    );
    expect(await screen.findByRole("button", { name: "喝茶" })).toBeTruthy();
  });
});

describe("Leitura workspace — mobile", () => {
  it("switches Leitura / Histórico / Painéis segments", async () => {
    const user = userEvent.setup();
    stubViewport(false);
    renderReading();

    await waitFor(() => expect(api.listReadingHistory).toHaveBeenCalledWith(8, 0));

    expect(screen.getByRole("tab", { name: "Leitura" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByText("Nenhuma leitura selecionada")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Nova leitura" })).toBeTruthy();
    expect(screen.queryByText("Meu vocabulário")).toBeNull();

    await user.click(screen.getByRole("tab", { name: "Histórico" }));
    expect(await screen.findByRole("button", { name: "Leitura #1, Parágrafo" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Carregar mais" })).toBeTruthy();

    await user.click(screen.getByRole("tab", { name: "Painéis" }));
    expect(await screen.findByText("Meu vocabulário")).toBeTruthy();
    expect(screen.getByText("Temas sorteáveis")).toBeTruthy();
  });

  it("uses Carregar mais to append the next history page", async () => {
    const user = userEvent.setup();
    stubViewport(false);
    renderReading();

    await user.click(await screen.findByRole("tab", { name: "Histórico" }));
    await user.click(await screen.findByRole("button", { name: "Carregar mais" }));

    await waitFor(() => expect(api.listReadingHistory).toHaveBeenCalledWith(8, 8));
  });

  it("opens a sticky word card from the article and dismisses it", async () => {
    const user = userEvent.setup();
    stubViewport(false);
    renderReading();

    await user.click(await screen.findByRole("tab", { name: "Histórico" }));
    await user.click(await screen.findByRole("button", { name: "Leitura #1, Parágrafo" }));

    await user.click(screen.getByRole("tab", { name: "Leitura" }));
    await user.click(await screen.findByRole("button", { name: "我" }));

    const sheet = await screen.findByRole("dialog", { name: "Palavra selecionada" });
    expect(within(sheet).getByText("eu")).toBeTruthy();

    await user.click(within(sheet).getByRole("button", { name: "Fechar palavra" }));
    expect(screen.queryByRole("dialog", { name: "Palavra selecionada" })).toBeNull();
  });
});
