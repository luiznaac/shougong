import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StrokePlayer } from "./StrokePlayer.tsx";

function strokesFor(character: string) {
  return { character, strokes: ["M0 0 L10 10", "M10 0 L0 10"], medians: [] };
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
        json: async () => strokesFor(character),
      } as Response;
    }),
  );
}

function renderPlayer(word: string, sizePx = 150) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <StrokePlayer word={word} sizePx={sizePx} />
    </QueryClientProvider>,
  );
}

beforeEach(stubStrokes);
afterEach(() => vi.unstubAllGlobals());

describe("StrokePlayer", () => {
  it("exposes a per-character picker for a multi-character word", async () => {
    renderPlayer("知道");

    expect(await screen.findByRole("button", { name: "Ver traços de 知" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ver traços de 道" })).toBeTruthy();
    expect(await screen.findByText(/1\/2 · traço 0\/2/)).toBeTruthy();
  });

  it("never resizes the viewer when the picked character changes", async () => {
    const user = userEvent.setup();
    renderPlayer("知道", 150);

    const first = await screen.findByRole("img", { name: "Ordem dos traços de 知" });
    expect(first.style.width).toBe("150px");
    expect(first.style.height).toBe("150px");

    await user.click(screen.getByRole("button", { name: "Ver traços de 道" }));

    const second = await screen.findByRole("img", { name: "Ordem dos traços de 道" });
    expect(second.style.width).toBe("150px");
    expect(second.style.height).toBe("150px");
    expect(screen.getByText(/2\/2 · traço 0\/2/)).toBeTruthy();
  });

  it("steps that character's strokes with its own counter", async () => {
    const user = userEvent.setup();
    renderPlayer("学", 104);

    expect(await screen.findByText(/traço 0\/2/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ver traços de 学" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Próximo traço" }));
    expect(screen.getByText(/traço 1\/2/)).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Próximo traço" }) as HTMLButtonElement).disabled,
    ).toBe(false);

    await user.click(screen.getByRole("button", { name: "Próximo traço" }));
    await waitFor(() => expect(screen.getByText(/traço 2\/2/)).toBeTruthy());
    expect(
      (screen.getByRole("button", { name: "Próximo traço" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
