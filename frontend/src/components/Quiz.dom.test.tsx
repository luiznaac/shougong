import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StudyItem } from "../api/types.ts";
import { studyItem } from "../test/studyItemFixture.ts";
import { Quiz } from "./Quiz.tsx";

function word(simplified: string, pinyin: string): StudyItem {
  return studyItem({ entry: { ...studyItem().entry, simplified, pinyin } });
}

function renderQuiz({
  mode = "review",
  record = false,
  item = studyItem(),
  desktop = false,
}: {
  mode?: "lesson" | "review";
  record?: boolean;
  item?: StudyItem;
  desktop?: boolean;
} = {}) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: desktop,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });

  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Quiz
          items={[item]}
          mode={mode}
          emptyMessage="Nada para praticar neste período."
          record={record}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function stubStrokes() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      const character = decodeURIComponent(
        url.split("/characters/")[1]?.split("/strokes")[0] ?? "",
      );
      return {
        ok: true,
        status: 200,
        json: async () => ({ character, strokes: ["M0 0 L10 10", "M10 0 L0 10"], medians: [] }),
      } as Response;
    }),
  );
}

beforeEach(stubStrokes);
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Quiz interaction", () => {
  it("keeps the advance disabled until a grade is chosen", async () => {
    const user = userEvent.setup();
    renderQuiz();

    await user.click(screen.getByRole("button", { name: /Revelar/ }));

    expect((screen.getByRole("button", { name: /Próximo/ }) as HTMLButtonElement).disabled).toBe(
      true,
    );

    await user.click(screen.getByRole("button", { name: /^Bom/ }));

    expect((screen.getByRole("button", { name: /Próximo/ }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it("undoes a chosen grade with rollback", async () => {
    const user = userEvent.setup();
    renderQuiz();

    await user.click(screen.getByRole("button", { name: /Revelar/ }));
    await user.click(screen.getByRole("button", { name: /^Bom/ }));
    expect((screen.getByRole("button", { name: /Próximo/ }) as HTMLButtonElement).disabled).toBe(
      false,
    );

    await user.click(screen.getByRole("button", { name: "Rollback" }));

    expect((screen.getByRole("button", { name: /Próximo/ }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("links the revealed item to its page under Biblioteca", async () => {
    const user = userEvent.setup();
    renderQuiz();

    await user.click(screen.getByRole("button", { name: /Revelar/ }));

    const link = screen.getByRole("link", { name: /ver página do item/ });
    expect(link.getAttribute("href")).toBe("/biblioteca/itens/1");
  });

  it("selects a grade from the keyboard hotkey and advances on Enter", async () => {
    const user = userEvent.setup();
    renderQuiz();

    await user.click(screen.getByRole("button", { name: /Revelar/ }));
    await user.keyboard("3");
    await user.keyboard("{Enter}");

    expect(await screen.findByText(/Prática concluída/)).toBeTruthy();
    expect(screen.getByText(/Nada foi registrado/)).toBeTruthy();
  });

  it("draws one glyph per phase: the player in info, hidden cards in prompt", async () => {
    const user = userEvent.setup();
    renderQuiz({ mode: "lesson", record: true, item: word("学习", "xue2 xi2") });

    expect(screen.queryAllByText("?")).toHaveLength(0);
    expect(await screen.findByRole("img", { name: "Ordem dos traços de 学" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Continuar/ }));

    expect(screen.queryByRole("img", { name: /Ordem dos traços/ })).toBeNull();
    expect(screen.getAllByText("?")).toHaveLength(2);
  });

  it("swaps the revealed answer cards for the player in place and back", async () => {
    const user = userEvent.setup();
    renderQuiz({ item: word("学习", "xue2 xi2") });

    await user.click(screen.getByRole("button", { name: /Revelar/ }));
    expect(screen.getAllByText("?")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: /Ver traços/ }));

    expect(screen.queryAllByText("?")).toHaveLength(0);
    expect(await screen.findByRole("img", { name: "Ordem dos traços de 学" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /← Cartões/ }));
    expect(screen.getAllByText("?")).toHaveLength(2);
  });

  it("keeps rollback reachable from the mobile top bar", () => {
    renderQuiz();

    expect(screen.getByRole("button", { name: "Rollback" })).toBeTruthy();
  });

  it("docks rollback and the keyboard legend on desktop", () => {
    renderQuiz({ desktop: true });

    expect(screen.getByRole("button", { name: "Rollback" })).toBeTruthy();
    expect(screen.getByText(/desfazer/)).toBeTruthy();
  });
});
