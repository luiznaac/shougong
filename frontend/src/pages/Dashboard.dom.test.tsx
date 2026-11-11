import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/client.ts";
import type { StudyItem, StudyOverview } from "../api/types.ts";
import { studyItem } from "../test/studyItemFixture.ts";
import { Dashboard } from "./Dashboard.tsx";

vi.mock("../api/client.ts", () => ({
  api: {
    getStudyOverview: vi.fn(),
    listStudyItems: vi.fn(),
    getExtraStudy: vi.fn(),
  },
}));

const ALL_ITEMS: StudyItem[] = Array.from({ length: 30 }, (_, i) => studyItem({ id: i + 1 }));
const LEECH_ITEMS: StudyItem[] = Array.from({ length: 4 }, (_, i) =>
  studyItem({ id: 100 + i, is_leech: true }),
);

function overview(overrides: Partial<StudyOverview> = {}): StudyOverview {
  return {
    new_count: 3,
    due_count: 24,
    due_review_count: 21,
    due_learning_count: 3,
    item_count: 30,
    leech_count: 4,
    srs_distribution: { novice: 6, apprentice: 15, journeyman: 2, expert: 0, master: 0 },
    next_seven_days: Array.from({ length: 7 }, (_, i) => ({
      date: `2026-11-${String(12 + i).padStart(2, "0")}`,
      due: i,
    })),
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

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return {
    ...view,
    tileCount: () => screen.queryAllByRole("link", { name: /學/ }).length,
  };
}

beforeEach(() => {
  vi.mocked(api.getStudyOverview).mockResolvedValue(overview());
  vi.mocked(api.getExtraStudy).mockResolvedValue({
    from: "2026-11-01T03:00:00.000Z",
    to: "2026-11-11T03:00:00.000Z",
    recent_mistakes: { total: 0, items: [] },
    recently_learned: { total: 0, items: [] },
  });
  vi.mocked(api.listStudyItems).mockImplementation(async (opts = {}) => {
    const source = opts.leech ? LEECH_ITEMS : ALL_ITEMS;
    const offset = opts.offset ?? 0;
    const limit = opts.limit ?? 20;
    return { items: source.slice(offset, offset + limit), total: source.length, limit, offset };
  });
});

describe("Hoje dashboard", () => {
  it("reads every aggregate from one overview request", async () => {
    const view = renderDashboard();

    await waitFor(() => expect(view.tileCount()).toBe(12));

    expect(api.getStudyOverview).toHaveBeenCalledTimes(1);
    expect(api.listStudyItems).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 12, offset: 0, sort: "stability_asc" }),
    );
  });

  it("leads with today's due and lesson counts", async () => {
    renderDashboard();

    expect(await screen.findByText("21")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Começar reviews/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Aprender 3 novas/ })).toBeTruthy();
  });

  it("disables the hero actions at zero", async () => {
    vi.mocked(api.getStudyOverview).mockResolvedValue(
      overview({ new_count: 0, due_count: 0, due_review_count: 0, due_learning_count: 0 }),
    );
    renderDashboard();

    const reviews = await screen.findByRole("link", { name: /Começar reviews/ });
    const lessons = screen.getByRole("link", { name: /Aprender 0 novas/ });
    expect(reviews.getAttribute("aria-disabled")).toBe("true");
    expect(lessons.getAttribute("aria-disabled")).toBe("true");
  });

  it("starts at twelve tiles and appends twelve at a time via the '+' tile", async () => {
    const user = userEvent.setup();
    const view = renderDashboard();

    await waitFor(() => expect(view.tileCount()).toBe(12));
    expect(screen.getByText("Mostrando 12 de 30")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Carregar mais caracteres/ }));

    await waitFor(() => expect(view.tileCount()).toBe(24));
    expect(screen.getByText("Mostrando 24 de 30")).toBeTruthy();
    expect(api.listStudyItems).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 12, offset: 12 }),
    );
  });

  it("switches the grid to the leeches, keeping the server order", async () => {
    const user = userEvent.setup();
    const view = renderDashboard();

    await waitFor(() => expect(view.tileCount()).toBe(12));
    expect(screen.getByRole("button", { name: "Todas (30)" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Sanguessugas (4)" }));

    await waitFor(() => expect(view.tileCount()).toBe(4));
    expect(screen.getByText("Mostrando 4 de 4")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Carregar mais caracteres/ })).toBeNull();
    expect(api.listStudyItems).toHaveBeenCalledWith(
      expect.objectContaining({ leech: true, limit: 12, offset: 0 }),
    );
  });
});
