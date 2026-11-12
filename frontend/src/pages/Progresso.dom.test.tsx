import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/client.ts";
import type { StudyItem, StudyOverview, VocabularyOverview } from "../api/types.ts";
import { studyItem } from "../test/studyItemFixture.ts";
import { vocabularySummary } from "../test/vocabularyFixture.ts";
import { Progresso } from "./Progresso.tsx";

vi.mock("../api/client.ts", () => ({
  api: {
    getVocabularyProfile: vi.fn(),
    getStudyOverview: vi.fn(),
    listStudyItems: vi.fn(),
  },
}));

function vocab(overrides: Partial<VocabularyOverview["summary"]> = {}): VocabularyOverview {
  return { profiles: [], summary: vocabularySummary(overrides) };
}

function overview(overrides: Partial<StudyOverview> = {}): StudyOverview {
  return {
    new_count: 0,
    due_count: 0,
    due_review_count: 0,
    due_learning_count: 0,
    item_count: 0,
    leech_count: 0,
    srs_distribution: { novice: 0, apprentice: 0, journeyman: 0, expert: 0, master: 0 },
    next_seven_days: [],
    learned: {
      total: 2,
      points: [
        { date: "2026-11-01", count: 1 },
        { date: "2026-11-10", count: 2 },
      ],
    },
    ...overrides,
  };
}

const RECENT: StudyItem[] = [
  studyItem({
    id: 7,
    entry: { ...studyItem().entry, simplified: "学", pinyin: "xue2" },
    card: { stability: 30 },
  }),
];

function renderProgresso() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Progresso />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(api.getVocabularyProfile).mockResolvedValue(vocab());
  vi.mocked(api.getStudyOverview).mockResolvedValue(overview());
  vi.mocked(api.listStudyItems).mockImplementation(async (opts = {}) => ({
    items: RECENT,
    total: RECENT.length,
    limit: opts.limit ?? 20,
    offset: opts.offset ?? 0,
  }));
});

describe("Progresso", () => {
  it("leads with the estimated level from the vocabulary aggregate", async () => {
    renderProgresso();

    expect(await screen.findByText("Nível estimado: HSK 2")).toBeTruthy();
  });

  it("renders HSK coverage, the vocabulary profile and the learned curve", async () => {
    renderProgresso();

    expect(await screen.findByText("Cobertura HSK")).toBeTruthy();
    expect(screen.getByText("Perfil de vocabulário")).toBeTruthy();
    expect(screen.getByText("Curva de aprendizado")).toBeTruthy();

    expect(await screen.findByText("80%")).toBeTruthy();
    expect(screen.getByText("substantivo")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Itens aprendidos ao longo do tempo" })).toBeTruthy();
  });

  it("reads each panel from a shipped aggregate and caps the recent words", async () => {
    renderProgresso();

    expect(await screen.findByText("Palavras recentes")).toBeTruthy();
    expect(api.getVocabularyProfile).toHaveBeenCalledTimes(1);
    expect(api.getStudyOverview).toHaveBeenCalledTimes(1);
    expect(api.listStudyItems).toHaveBeenCalledWith(
      expect.objectContaining({ sort: "created_desc", limit: 5, offset: 0 }),
    );
    expect(await screen.findByText("Journeyman I")).toBeTruthy();
    expect(screen.getByRole("link", { name: /学/ }).getAttribute("href")).toBe(
      "/biblioteca/itens/7",
    );
  });

  it("gives every panel its own empty state on an empty library", async () => {
    vi.mocked(api.getVocabularyProfile).mockResolvedValue(
      vocab({
        total: 0,
        categorised: 0,
        by_category: {},
        by_hsk_level: {},
        proficiency: { coverage_by_level: {}, estimated_level: 0 },
      }),
    );
    vi.mocked(api.getStudyOverview).mockResolvedValue(
      overview({ learned: { total: 0, points: [] } }),
    );
    vi.mocked(api.listStudyItems).mockResolvedValue({
      items: [],
      total: 0,
      limit: 5,
      offset: 0,
    });

    renderProgresso();

    expect(await screen.findByText("Cobertura HSK indisponível")).toBeTruthy();
    expect(screen.getByText("Nenhuma palavra no vocabulário ainda")).toBeTruthy();
    expect(screen.getByText("Nenhum item aprendido ainda.")).toBeTruthy();
    expect(screen.getByText("Nenhuma palavra recente")).toBeTruthy();
    expect(screen.getByText("Nível estimado: Iniciante")).toBeTruthy();
  });

  it("gives every panel its own loading state", async () => {
    const pending = new Promise<never>(() => {});
    vi.mocked(api.getVocabularyProfile).mockReturnValue(pending);
    vi.mocked(api.getStudyOverview).mockReturnValue(pending);
    vi.mocked(api.listStudyItems).mockReturnValue(pending);

    renderProgresso();

    expect(screen.getByText("Carregando cobertura HSK")).toBeTruthy();
    expect(screen.getByText("Carregando perfil de vocabulário")).toBeTruthy();
    expect(screen.getByText("Carregando curva de aprendizado")).toBeTruthy();
    expect(screen.getByText("Carregando palavras recentes")).toBeTruthy();
  });
});
