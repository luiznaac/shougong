import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../api/client.ts";
import { Ajustes } from "./Ajustes.tsx";

vi.mock("../api/client.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client.ts")>();
  return {
    ...actual,
    api: {
      getHanziHeroStatus: vi.fn(),
      connectHanziHero: vi.fn(),
    },
  };
});

const ENABLED_KEY = "shougong.handwriting.enabled";
const AUTO_REVEAL_KEY = "shougong.handwriting.autoReveal";

function renderAjustes() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <Ajustes />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(api.getHanziHeroStatus).mockResolvedValue({
    connected: false,
    connected_at: null,
    last_synced_at: null,
  });
});

describe("Ajustes", () => {
  it("shows the HanziHero connection panel beside the handwriting preferences", async () => {
    renderAjustes();

    expect(screen.getByRole("heading", { name: "HanziHero" })).toBeTruthy();
    expect(await screen.findByLabelText("E-mail ou usuário")).toBeTruthy();
  });

  it("exposes the handwriting toggle, off by default, and no tolerance control", () => {
    renderAjustes();

    const toggle = screen.getByRole("checkbox", { name: "Checagem de escrita à mão" });

    expect((toggle as HTMLInputElement).checked).toBe(false);
    expect(screen.queryByLabelText("Tolerância de erros")).toBeNull();
  });

  it("persists the handwriting toggle across a reload and reads it back", async () => {
    const user = userEvent.setup();
    const first = renderAjustes();

    await user.click(screen.getByRole("checkbox", { name: "Checagem de escrita à mão" }));

    expect(localStorage.getItem(ENABLED_KEY)).toBe("true");

    first.unmount();
    renderAjustes();

    expect(
      (screen.getByRole("checkbox", { name: "Checagem de escrita à mão" }) as HTMLInputElement)
        .checked,
    ).toBe(true);
  });

  it("turns the check back off and stores the choice", async () => {
    const user = userEvent.setup();
    renderAjustes();

    const toggle = screen.getByRole("checkbox", { name: "Checagem de escrita à mão" });
    await user.click(toggle);
    await user.click(toggle);

    expect(localStorage.getItem(ENABLED_KEY)).toBe("false");
    expect((toggle as HTMLInputElement).checked).toBe(false);
  });

  it("exposes auto-reveal, on by default", () => {
    renderAjustes();

    const toggle = screen.getByRole("checkbox", { name: "Revelar automaticamente" });

    expect((toggle as HTMLInputElement).checked).toBe(true);
    expect(localStorage.getItem(AUTO_REVEAL_KEY)).toBeNull();
  });

  it("persists turning auto-reveal off across a reload", async () => {
    const user = userEvent.setup();
    const first = renderAjustes();

    await user.click(screen.getByRole("checkbox", { name: "Revelar automaticamente" }));

    expect(localStorage.getItem(AUTO_REVEAL_KEY)).toBe("false");

    first.unmount();
    renderAjustes();

    expect(
      (screen.getByRole("checkbox", { name: "Revelar automaticamente" }) as HTMLInputElement)
        .checked,
    ).toBe(false);
  });
});
