import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "../api/client.ts";
import type { HanziHeroStatus } from "../api/types.ts";
import { formatDateTime } from "../lib/format.ts";
import { HanziHeroPanel } from "./HanziHeroPanel.tsx";

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

function disconnected(): HanziHeroStatus {
  return { connected: false, connected_at: null, last_synced_at: null };
}

function connected(overrides: Partial<HanziHeroStatus> = {}): HanziHeroStatus {
  return {
    connected: true,
    connected_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    last_synced_at: null,
    ...overrides,
  };
}

function renderPanel(props: { expired?: boolean } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <HanziHeroPanel {...props} />
    </QueryClientProvider>,
  );
}

function currentStep(): string | null {
  const items = screen.getAllByRole("listitem");
  const active = items.find((item) => item.getAttribute("aria-current") === "step");
  return active?.textContent ?? null;
}

beforeEach(() => {
  vi.mocked(api.getHanziHeroStatus).mockResolvedValue(disconnected());
  vi.mocked(api.connectHanziHero).mockReset();
});

describe("HanziHeroPanel", () => {
  it("renders the three-step rail with the connect step active while disconnected", async () => {
    renderPanel();

    const rail = await screen.findByRole("list", { name: "Etapas da sincronização" });
    expect(rail).toBeTruthy();
    expect(within(rail).getByText("Conectar")).toBeTruthy();
    expect(within(rail).getByText("Sincronizar")).toBeTruthy();
    expect(within(rail).getByText("Resultado")).toBeTruthy();
    expect(currentStep()).toContain("Conectar");

    expect(screen.getByLabelText("E-mail ou usuário")).toBeTruthy();
    expect(screen.getByLabelText("Senha")).toBeTruthy();
    expect(screen.getByText(/A senha não é guardada/)).toBeTruthy();
    expect(screen.queryByText(/^Conectado como/)).toBeNull();
  });

  it("validates empty fields inline without calling the API", async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(await screen.findByRole("button", { name: "Conectar" }));

    expect(screen.getByRole("alert").textContent).toContain("Informe e-mail/usuário e senha.");
    expect(api.connectHanziHero).not.toHaveBeenCalled();
  });

  it("surfaces a failed login and keeps what the learner typed", async () => {
    const user = userEvent.setup();
    vi.mocked(api.connectHanziHero).mockRejectedValue(
      new ApiError(400, "HanziHero rejected the credentials"),
    );
    renderPanel();

    const handle = await screen.findByLabelText("E-mail ou usuário");
    const password = screen.getByLabelText("Senha");
    await user.type(handle, "learner");
    await user.type(password, "wrong");
    await user.click(screen.getByRole("button", { name: "Conectar" }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("E-mail/usuário ou senha incorretos"),
    );
    expect((handle as HTMLInputElement).value).toBe("learner");
    expect((password as HTMLInputElement).value).toBe("wrong");
    expect(screen.getByRole("button", { name: "Conectar" })).toBeTruthy();
  });

  it("shows the connected state after a successful connect, never synced", async () => {
    const user = userEvent.setup();
    const status = connected();
    vi.mocked(api.connectHanziHero).mockImplementation(async () => {
      vi.mocked(api.getHanziHeroStatus).mockResolvedValue(status);
      return status;
    });
    renderPanel();

    await user.type(await screen.findByLabelText("E-mail ou usuário"), "learner");
    await user.type(screen.getByLabelText("Senha"), "secret");
    await user.click(screen.getByRole("button", { name: "Conectar" }));

    expect(await screen.findByText("Conectado como learner")).toBeTruthy();
    expect(currentStep()).toContain("Sincronizar");
    expect(screen.getByText(/Sessão iniciada há 5 dias/)).toBeTruthy();
    expect(screen.getByText(/Última sincronização: nunca/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Sincronizar/ })).toBeNull();
  });

  it("shows the last sync instant once a sync has run", async () => {
    const syncedAt = "2026-11-20T12:12:00Z";
    vi.mocked(api.getHanziHeroStatus).mockResolvedValue(connected({ last_synced_at: syncedAt }));
    renderPanel();

    expect(await screen.findByText("Conta HanziHero conectada")).toBeTruthy();
    expect(screen.getByText(`Última sincronização: ${formatDateTime(syncedAt)}`)).toBeTruthy();
    expect(screen.queryByText(/nunca/)).toBeNull();
  });

  it("reuses the connect step with an explicit expired-session notice", async () => {
    renderPanel({ expired: true });

    expect(await screen.findByText(/Sua sessão do HanziHero expirou/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reconectar" })).toBeTruthy();
    expect(currentStep()).toContain("Conectar");
  });
});
