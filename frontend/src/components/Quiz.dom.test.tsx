import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StudyItem } from "../api/types.ts";
import { studyItem } from "../test/studyItemFixture.ts";
import type { HandwritingStepProps } from "./HandwritingQuiz.tsx";
import { Quiz } from "./Quiz.tsx";

const ENABLED_KEY = "shougong.handwriting.enabled";
const AUTO_REVEAL_KEY = "shougong.handwriting.autoReveal";

function word(simplified: string, pinyin: string): StudyItem {
  return studyItem({ entry: { ...studyItem().entry, simplified, pinyin } });
}

/** The handwriting child double: a button that reports a snapshot on demand. */
const MODEL_STROKES = ["M0 0 L10 10", "M10 0 L0 10"];

let mountSequence = 0;

function mountId(name: string): number {
  return Number(screen.getByRole("button", { name }).getAttribute("data-mount"));
}

function CompletionDouble({ character, onComplete }: HandwritingStepProps) {
  const [mountId] = useState(() => ++mountSequence);
  return (
    <button
      type="button"
      data-mount={mountId}
      onClick={() =>
        onComplete({
          drawing: { strokes: ["M0 0 L10 10"], size: 170 },
          model: MODEL_STROKES,
        })
      }
    >
      Concluir {character}
    </button>
  );
}

function renderQuiz({
  mode = "review",
  record = false,
  item = studyItem(),
  desktop = false,
  handwriting = false,
}: {
  mode?: "lesson" | "review";
  record?: boolean;
  item?: StudyItem;
  desktop?: boolean;
  handwriting?: boolean;
} = {}) {
  if (handwriting) localStorage.setItem(ENABLED_KEY, "true");
  else localStorage.removeItem(ENABLED_KEY);

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
          HandwritingStep={CompletionDouble}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

let fetchMock: ReturnType<typeof vi.fn>;

function stubStrokes() {
  fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    const character = decodeURIComponent(url.split("/characters/")[1]?.split("/strokes")[0] ?? "");
    return {
      ok: true,
      status: 200,
      json: async () => ({ character, strokes: ["M0 0 L10 10", "M10 0 L0 10"], medians: [] }),
    } as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
}

function reviewCalls(): number {
  return fetchMock.mock.calls.filter(([input]) => String(input).includes("/reviews")).length;
}

function strokeCalls(): number {
  return fetchMock.mock.calls.filter(([input]) => String(input).includes("/strokes")).length;
}

/** The nearest element that contains both nodes — the region they share. */
function sharedAncestor(a: Element, b: Element): Element {
  const chain = new Set<Element>();
  for (let node: Element | null = a; node; node = node.parentElement) chain.add(node);
  for (let node: Element | null = b; node; node = node.parentElement) {
    if (chain.has(node)) return node;
  }
  throw new Error("the two elements share no ancestor");
}

beforeEach(() => {
  localStorage.clear();
  stubStrokes();
});
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

  it("drops the band's hidden-card glyph while the writing canvas is the glyph", async () => {
    const user = userEvent.setup();
    renderQuiz({ mode: "lesson", handwriting: true, item: word("学习", "xue2 xi2") });

    await user.click(screen.getByRole("button", { name: /Continuar/ }));

    expect(screen.getByRole("button", { name: "Concluir 学" })).toBeTruthy();
    expect(screen.queryAllByText("?")).toHaveLength(0);
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

  it("shows each character's writing level and marks a missing one unknown", async () => {
    const user = userEvent.setup();
    const item = studyItem({
      entry: {
        ...studyItem().entry,
        simplified: "好啊吗",
        pinyin: "hao3 a5 ma5",
        hsk_level: 1,
        handwriting_level: 3,
      },
      character_writing_levels: { 好: 2, 啊: 3, 吗: null },
    });
    renderQuiz({ item });

    await user.click(screen.getByRole("button", { name: /Revelar/ }));

    expect(screen.getByLabelText("Nível de escrita de 好: 2")).toBeTruthy();
    expect(screen.getByLabelText("Nível de escrita de 啊: 3")).toBeTruthy();
    expect(screen.getByLabelText("Nível de escrita de 吗: desconhecido")).toBeTruthy();
    expect(screen.getByText("HSK 1")).toBeTruthy();
    expect(screen.getByText("escrita HSK 3")).toBeTruthy();
  });

  it("keeps rollback reachable from the mobile top bar", () => {
    renderQuiz();

    expect(screen.getByRole("button", { name: "Rollback" })).toBeTruthy();
  });

  it("renders the mobile dock outside the band and middle region", () => {
    renderQuiz();

    const band = screen.getByText("Prática");
    const middle = screen.getByText("Escreva o caractere à mão");
    const region = sharedAncestor(band, middle);
    const dock = screen.getByRole("contentinfo");

    expect(region.contains(dock)).toBe(false);
  });

  it("docks rollback and the keyboard legend on desktop", () => {
    renderQuiz({ desktop: true });

    expect(screen.getByRole("button", { name: "Rollback" })).toBeTruthy();
    expect(screen.getByText(/desfazer/)).toBeTruthy();
  });

  it("completes a single character into the reveal with no grade pre-selected", async () => {
    const user = userEvent.setup();
    renderQuiz({ handwriting: true, item: word("好", "hao3") });

    await user.click(screen.getByRole("button", { name: "Concluir 好" }));

    for (const label of ["Errei", "Difícil", "Bom", "Fácil"]) {
      const key = screen.getByRole("button", { name: new RegExp(`^${label}`) });
      expect(key.getAttribute("aria-pressed")).toBe("false");
    }
    expect((screen.getByRole("button", { name: /Próximo/ }) as HTMLButtonElement).disabled).toBe(
      true,
    );

    await user.click(screen.getByRole("button", { name: /^Bom/ }));
    expect((screen.getByRole("button", { name: /Próximo/ }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it("advances character by character through a multi-character word", async () => {
    const user = userEvent.setup();
    renderQuiz({ handwriting: true, item: word("学习", "xue2 xi2") });

    await user.click(screen.getByRole("button", { name: "Concluir 学" }));

    expect(screen.getByRole("button", { name: "Concluir 习" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Próximo/ })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Concluir 习" }));

    expect(screen.getByRole("button", { name: /Próximo/ })).toBeTruthy();
  });

  it("does not record a review merely by finishing a drawing", async () => {
    const user = userEvent.setup();
    renderQuiz({ handwriting: true, record: true, item: word("好", "hao3") });

    await user.click(screen.getByRole("button", { name: "Concluir 好" }));

    expect(reviewCalls()).toBe(0);
  });

  it("runs the same self-check in a lesson after studying the strokes", async () => {
    const user = userEvent.setup();
    renderQuiz({ mode: "lesson", handwriting: true, record: true, item: word("好", "hao3") });

    await user.click(screen.getByRole("button", { name: /Continuar/ }));
    await user.click(screen.getByRole("button", { name: "Concluir 好" }));

    expect((screen.getByRole("button", { name: /Próximo/ }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it("records no grade in practice even after choosing a note and advancing", async () => {
    const user = userEvent.setup();
    renderQuiz({ handwriting: true, record: false, item: word("好", "hao3") });

    await user.click(screen.getByRole("button", { name: "Concluir 好" }));
    await user.click(screen.getByRole("button", { name: /^Bom/ }));
    await user.click(screen.getByRole("button", { name: /Próximo/ }));

    expect(await screen.findByText(/Prática concluída/)).toBeTruthy();
    expect(reviewCalls()).toBe(0);
  });

  it("shows one slot per character while recalling, even for a single character", () => {
    renderQuiz({ handwriting: true, item: word("好", "hao3") });

    const slots = screen.getAllByRole("listitem");
    expect(slots).toHaveLength(1);
    expect(slots[0].getAttribute("aria-current")).toBe("step");
  });

  it("moves the current highlight and keeps each completed drawing during recall", async () => {
    const user = userEvent.setup();
    renderQuiz({ handwriting: true, item: word("学习", "xue2 xi2") });

    expect(screen.getAllByRole("listitem")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Concluir 学" }));

    expect(screen.getByRole("img", { name: "Seu traço de 学" })).toBeTruthy();
    expect(screen.getAllByRole("listitem")[1].getAttribute("aria-current")).toBe("step");
    expect(screen.getByRole("button", { name: "Concluir 习" })).toBeTruthy();
  });

  it("clears only the current character and keeps the earlier drawings", async () => {
    const user = userEvent.setup();
    renderQuiz({ handwriting: true, item: word("学习", "xue2 xi2") });

    await user.click(screen.getByRole("button", { name: "Concluir 学" }));
    const before = mountId("Concluir 习");

    await user.click(screen.getByRole("button", { name: "Limpar" }));

    const after = mountId("Concluir 习");

    expect(after).toBeGreaterThan(before);
    expect(screen.getByRole("img", { name: "Seu traço de 学" })).toBeTruthy();
    expect(screen.getAllByRole("listitem")[1].getAttribute("aria-current")).toBe("step");
    expect(screen.queryByRole("button", { name: /Próximo/ })).toBeNull();
  });

  it("offers Limpar on a single character and stays in recall", async () => {
    const user = userEvent.setup();
    renderQuiz({ handwriting: true, item: word("好", "hao3") });

    await user.click(screen.getByRole("button", { name: "Limpar" }));

    expect(screen.getByRole("button", { name: "Concluir 好" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Próximo/ })).toBeNull();
  });

  it("hides Limpar when handwriting is off", () => {
    renderQuiz({ item: word("好", "hao3") });

    expect(screen.queryByRole("button", { name: "Limpar" })).toBeNull();
  });

  it("shows the learner's drawing beside the model for every slot at the final reveal", async () => {
    const user = userEvent.setup();
    renderQuiz({ handwriting: true, item: word("学习", "xue2 xi2") });

    await user.click(screen.getByRole("button", { name: "Concluir 学" }));
    await user.click(screen.getByRole("button", { name: "Concluir 习" }));

    expect(screen.getAllByText("Seu traço")).toHaveLength(2);
    expect(screen.getAllByText("Modelo")).toHaveLength(2);
    expect(screen.getByRole("img", { name: "Seu traço de 学" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Seu traço de 习" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Ordem dos traços de 学" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Ordem dos traços de 习" })).toBeTruthy();
  });

  it("draws the model from the already-fetched strokes without another request", async () => {
    const user = userEvent.setup();
    renderQuiz({ handwriting: true, item: word("好", "hao3") });

    await user.click(screen.getByRole("button", { name: "Concluir 好" }));

    expect(screen.getByRole("img", { name: "Ordem dos traços de 好" })).toBeTruthy();
    expect(strokeCalls()).toBe(0);
  });

  it("hides the band's cards while the middle carries the handwriting glyph", async () => {
    const user = userEvent.setup();
    renderQuiz({ handwriting: true, item: word("好", "hao3") });

    // Recall already owns the glyph (the canvas), so the band keeps no hidden card.
    expect(screen.queryAllByText("?")).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Concluir 好" }));

    expect(screen.queryAllByText("?")).toHaveLength(0);
    expect(screen.getByText("estudar")).toBeTruthy();
  });

  it("asks the learner to write, then to compare the drawings with the model", async () => {
    const user = userEvent.setup();
    renderQuiz({ handwriting: true, item: word("好", "hao3") });

    expect(screen.getByText("Escreva o caractere à mão")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Concluir 好" }));

    expect(screen.getByText("Compare seu traço com o modelo")).toBeTruthy();
  });

  it("keeps the flip-card reveal prompt when handwriting is off", async () => {
    const user = userEvent.setup();
    renderQuiz({ item: word("好", "hao3") });

    await user.click(screen.getByRole("button", { name: /Revelar/ }));

    expect(screen.getByText("Você acertou a escrita?")).toBeTruthy();
    expect(screen.queryByText("Compare seu traço com o modelo")).toBeNull();
  });

  it("shows the comparison in practice and still records no grade", async () => {
    const user = userEvent.setup();
    renderQuiz({ handwriting: true, record: false, item: word("好", "hao3") });

    await user.click(screen.getByRole("button", { name: "Concluir 好" }));

    expect(screen.getAllByText("Modelo")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: /^Bom/ }));
    await user.click(screen.getByRole("button", { name: /Próximo/ }));

    expect(await screen.findByText(/Prática concluída/)).toBeTruthy();
    expect(reviewCalls()).toBe(0);
  });

  it("shows the comparison in a lesson after studying the strokes", async () => {
    const user = userEvent.setup();
    renderQuiz({ mode: "lesson", record: true, handwriting: true, item: word("好", "hao3") });

    await user.click(screen.getByRole("button", { name: /Continuar/ }));
    await user.click(screen.getByRole("button", { name: "Concluir 好" }));

    expect(screen.getAllByText("Seu traço")).toHaveLength(1);
    expect(screen.getAllByText("Modelo")).toHaveLength(1);
  });

  it("peeks at only the current character, then continues to the next", async () => {
    const user = userEvent.setup();
    renderQuiz({ handwriting: true, item: word("学习", "xue2 xi2") });

    await user.click(screen.getByRole("button", { name: /Revelar/ }));

    expect(screen.getByText("Compare este caractere com o modelo")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Continuar/ })).toBeTruthy();
    expect(screen.getByLabelText("Comparação de 学")).toBeTruthy();
    expect(screen.queryByLabelText("Comparação de 习")).toBeNull();
    expect(screen.getAllByText("Seu traço")).toHaveLength(1);
    expect(screen.getAllByText("Modelo")).toHaveLength(1);
    expect((screen.getByRole("button", { name: /^Bom/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(await screen.findByRole("img", { name: "Ordem dos traços de 学" })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: /Continuar/ }));

    expect(screen.getByRole("button", { name: "Concluir 习" })).toBeTruthy();
    expect(screen.queryByLabelText("Comparação de 学")).toBeNull();
  });

  it("waits for Revelar after the last character when auto-reveal is off", async () => {
    localStorage.setItem(AUTO_REVEAL_KEY, "false");
    const user = userEvent.setup();
    renderQuiz({ handwriting: true, item: word("好", "hao3") });

    await user.click(screen.getByRole("button", { name: "Concluir 好" }));

    expect(screen.queryByText("Modelo")).toBeNull();
    expect(screen.getByText(/Revelar.*comparar a palavra/)).toBeTruthy();
    expect((screen.getByRole("button", { name: /^Bom/ }) as HTMLButtonElement).disabled).toBe(true);

    await user.click(screen.getByRole("button", { name: /Revelar/ }));

    expect(screen.getByText("Compare seu traço com o modelo")).toBeTruthy();
    expect(screen.getByText("Modelo")).toBeTruthy();
    expect((screen.getByRole("button", { name: /^Bom/ }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it("waits for Revelar on the last character of a word, then compares the whole word", async () => {
    localStorage.setItem(AUTO_REVEAL_KEY, "false");
    const user = userEvent.setup();
    renderQuiz({ handwriting: true, item: word("学习", "xue2 xi2") });

    await user.click(screen.getByRole("button", { name: "Concluir 学" }));

    expect(screen.getByRole("button", { name: "Concluir 习" })).toBeTruthy();
    expect(screen.queryByText("Modelo")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Concluir 习" }));

    expect(screen.queryByText("Modelo")).toBeNull();
    await user.click(screen.getByRole("button", { name: /Revelar/ }));

    expect(screen.getAllByText("Seu traço")).toHaveLength(2);
    expect(screen.getAllByText("Modelo")).toHaveLength(2);
    expect(screen.getByRole("img", { name: "Ordem dos traços de 学" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Ordem dos traços de 习" })).toBeTruthy();
  });
});
