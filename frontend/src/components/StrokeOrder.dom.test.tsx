import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StrokeOrder } from "./StrokeOrder.tsx";

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        character: "學",
        strokes: ["M0 0 L10 10", "M10 0 L0 10"],
        medians: [],
      }),
    })) as unknown as typeof fetch,
  );
});

afterEach(() => vi.unstubAllGlobals());

function renderViewer() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <StrokeOrder character="學" sizePx={160} />
    </QueryClientProvider>,
  );
}

describe("StrokeOrder", () => {
  it("draws the glyph through the shared StrokeGlyph and steps its strokes", async () => {
    const user = userEvent.setup();
    renderViewer();

    const glyph = await screen.findByRole("img", { name: "Ordem dos traços de 學" });
    expect(glyph.style.width).toBe("160px");
    expect(screen.getByText("traço 0/2")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Próximo →" }));
    expect(screen.getByText("traço 1/2")).toBeTruthy();
  });
});
