import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/client.ts";
import type { ReadingTopic } from "../api/types.ts";
import { ReadingTopicsPanel } from "./ReadingTopicsPanel.tsx";

vi.mock("../api/client.ts", () => ({
  api: {
    listReadingTopics: vi.fn(),
    addReadingTopic: vi.fn(),
    setReadingTopicActive: vi.fn(),
    deleteReadingTopic: vi.fn(),
  },
}));

const TOPIC: ReadingTopic = { id: 7, scenario: "a lost key", active: true };

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ReadingTopicsPanel />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.mocked(api.listReadingTopics).mockResolvedValue([TOPIC]);
  vi.mocked(api.deleteReadingTopic).mockResolvedValue(undefined);
});

describe("Temas sorteáveis", () => {
  it("asks for an inline confirmation before deleting a topic", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole("button", { name: "remover" }));

    expect(api.deleteReadingTopic).not.toHaveBeenCalled();
    expect(screen.getByText("Remover este tema?")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Confirmar remoção" }));

    expect(api.deleteReadingTopic).toHaveBeenCalledWith(TOPIC.id);
  });

  it("shows an empty state when there are no topics", async () => {
    vi.mocked(api.listReadingTopics).mockResolvedValue([]);
    renderPanel();

    expect(await screen.findByText("Nenhum tema ainda. Adicione um cenário acima.")).toBeTruthy();
  });

  it("keeps the topic when the confirmation is cancelled", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole("button", { name: "remover" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(api.deleteReadingTopic).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "remover" })).toBeTruthy();
  });
});
