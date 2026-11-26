import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "../api/client.ts";
import type {
  BatchImportOutcome,
  DictionaryEntry,
  HanziHeroStatus,
  HanziHeroSyncResponse,
} from "../api/types.ts";
import { formatDateTime } from "../lib/format.ts";
import { HanziHeroPanel } from "./HanziHeroPanel.tsx";

vi.mock("../api/client.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/client.ts")>();
  return {
    ...actual,
    api: {
      getHanziHeroStatus: vi.fn(),
      connectHanziHero: vi.fn(),
      syncHanziHero: vi.fn(),
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

function candidate(overrides: Partial<DictionaryEntry> = {}): DictionaryEntry {
  return {
    id: 1201,
    simplified: "干",
    pinyin: "gan1",
    definitions: ["secar", "fazer"],
    hsk_level: null,
    pos_tags: [],
    handwriting_level: null,
    ...overrides,
  };
}

function outcome(overrides: Partial<BatchImportOutcome>): BatchImportOutcome {
  return {
    row: 1,
    hanzi: "学习",
    pinyin: "xue2 xi2",
    status: "created",
    study_item_id: 1,
    detail: null,
    candidates: [],
    ...overrides,
  };
}

function syncResponse(overrides: Partial<HanziHeroSyncResponse> = {}): HanziHeroSyncResponse {
  return {
    created: 1,
    already_in_queue: 1,
    unmatched: 2,
    last_synced_at: "2026-11-26T12:00:00Z",
    outcomes: [
      outcome({ row: 1, hanzi: "学习", pinyin: "xue2 xi2", status: "created" }),
      outcome({ row: 2, hanzi: "你好", pinyin: "ni3 hao3", status: "skipped", study_item_id: 2 }),
      outcome({
        row: 3,
        hanzi: "干",
        pinyin: "gan4",
        status: "error",
        study_item_id: null,
        detail: "Hanzi encontrado, mas nenhuma leitura gan4.",
        candidates: [candidate()],
      }),
      outcome({
        row: 4,
        hanzi: "着",
        pinyin: "zhe5",
        status: "error",
        study_item_id: null,
        detail: "Tom neutro não encontrado.",
        candidates: [
          candidate({ id: 1301, simplified: "着", pinyin: "zhao2", definitions: ["peça"] }),
        ],
      }),
    ],
    ...overrides,
  };
}

function renderPanel() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <HanziHeroPanel />
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
  vi.mocked(api.syncHanziHero).mockReset();
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

  it("shows the connected state with the Sync action after a successful connect", async () => {
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
    expect(screen.getByRole("button", { name: "Sincronizar agora" })).toBeTruthy();
  });

  it("shows the last sync instant once a sync has run", async () => {
    const syncedAt = "2026-11-20T12:12:00Z";
    vi.mocked(api.getHanziHeroStatus).mockResolvedValue(connected({ last_synced_at: syncedAt }));
    renderPanel();

    expect(await screen.findByText("Conta HanziHero conectada")).toBeTruthy();
    expect(screen.getByText(`Última sincronização: ${formatDateTime(syncedAt)}`)).toBeTruthy();
    expect(screen.queryByText(/nunca/)).toBeNull();
  });

  it("shows a running progress state while the sync request is in flight", async () => {
    const user = userEvent.setup();
    vi.mocked(api.getHanziHeroStatus).mockResolvedValue(connected());
    let resolveSync: (value: HanziHeroSyncResponse) => void = () => {};
    vi.mocked(api.syncHanziHero).mockReturnValue(
      new Promise<HanziHeroSyncResponse>((resolve) => {
        resolveSync = resolve;
      }),
    );
    renderPanel();

    await user.click(await screen.findByRole("button", { name: "Sincronizar agora" }));

    expect(screen.getByRole("status").textContent).toContain("Sincronizando");
    expect(screen.queryByRole("button", { name: "Sincronizar agora" })).toBeNull();

    resolveSync(syncResponse());

    expect(await screen.findByText(/Sincronizado/)).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows the count tiles and tabs across the result groups", async () => {
    const user = userEvent.setup();
    vi.mocked(api.getHanziHeroStatus).mockResolvedValue(connected());
    vi.mocked(api.syncHanziHero).mockResolvedValue(syncResponse());
    renderPanel();

    await user.click(await screen.findByRole("button", { name: "Sincronizar agora" }));

    expect(await screen.findByLabelText("criados: 1")).toBeTruthy();
    expect(screen.getByLabelText("já na fila: 1")).toBeTruthy();
    expect(screen.getByLabelText("sem correspondência: 2")).toBeTruthy();

    // The unmatched group is the default because it is the one needing attention.
    expect(
      screen.getByRole("button", { name: "Sem correspondência (2)" }).getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getByText("干")).toBeTruthy();
    expect(screen.queryByText("学习")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Criados (1)" }));
    expect(screen.getByText("学习")).toBeTruthy();
    expect(screen.queryByText("干")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Já na fila (1)" }));
    expect(screen.getByText("你好")).toBeTruthy();
  });

  it("shows unmatched rows with their candidate readings inline", async () => {
    const user = userEvent.setup();
    vi.mocked(api.getHanziHeroStatus).mockResolvedValue(connected());
    vi.mocked(api.syncHanziHero).mockResolvedValue(syncResponse());
    renderPanel();

    await user.click(await screen.findByRole("button", { name: "Sincronizar agora" }));

    expect(await screen.findByText(/Hanzi encontrado, mas nenhuma leitura gan4/)).toBeTruthy();
    expect(screen.getByText(/gan1/)).toBeTruthy();
    expect(screen.getByText(/secar; fazer/)).toBeTruthy();
    expect(screen.getByText(/zhao2/)).toBeTruthy();
  });

  it("returns to the connect step with the expired-session notice when a sync is rejected", async () => {
    const user = userEvent.setup();
    vi.mocked(api.getHanziHeroStatus).mockResolvedValue(connected());
    vi.mocked(api.syncHanziHero).mockRejectedValue(
      new ApiError(409, "session expired", "hanzihero_reconnect_required"),
    );
    renderPanel();

    await user.click(await screen.findByRole("button", { name: "Sincronizar agora" }));

    expect(await screen.findByText(/Sua sessão do HanziHero expirou/)).toBeTruthy();
    expect(currentStep()).toContain("Conectar");
    expect(screen.getByRole("button", { name: "Reconectar" })).toBeTruthy();
    expect(screen.queryByText(/Sincronizado/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Sincronizar novamente" })).toBeNull();
    expect(screen.queryByLabelText(/criados:/)).toBeNull();
  });

  it("lets the learner reconnect after an expired session and sync again", async () => {
    const user = userEvent.setup();
    vi.mocked(api.getHanziHeroStatus).mockResolvedValue(connected());
    vi.mocked(api.syncHanziHero).mockRejectedValue(
      new ApiError(409, "session expired", "hanzihero_reconnect_required"),
    );
    vi.mocked(api.connectHanziHero).mockResolvedValue(connected());
    renderPanel();

    await user.click(await screen.findByRole("button", { name: "Sincronizar agora" }));
    await screen.findByText(/Sua sessão do HanziHero expirou/);

    await user.type(screen.getByLabelText("E-mail ou usuário"), "learner");
    await user.type(screen.getByLabelText("Senha"), "secret");
    await user.click(screen.getByRole("button", { name: "Reconectar" }));

    expect(await screen.findByRole("button", { name: "Sincronizar agora" })).toBeTruthy();
    expect(screen.queryByText(/Sua sessão do HanziHero expirou/)).toBeNull();
  });

  it("re-syncs safely: the summary reports already-in-queue and never a reset", async () => {
    const user = userEvent.setup();
    vi.mocked(api.getHanziHeroStatus).mockResolvedValue(connected());
    vi.mocked(api.syncHanziHero)
      .mockResolvedValueOnce(syncResponse())
      .mockResolvedValueOnce(
        syncResponse({
          created: 0,
          already_in_queue: 3,
          unmatched: 0,
          outcomes: [
            outcome({ row: 1, hanzi: "学习", status: "skipped", study_item_id: 1 }),
            outcome({ row: 2, hanzi: "你好", status: "skipped", study_item_id: 2 }),
            outcome({ row: 3, hanzi: "朋友", status: "skipped", study_item_id: 3 }),
          ],
        }),
      );
    renderPanel();

    await user.click(await screen.findByRole("button", { name: "Sincronizar agora" }));
    await user.click(await screen.findByRole("button", { name: "Sincronizar novamente" }));

    expect(await screen.findByLabelText("já na fila: 3")).toBeTruthy();
    expect(screen.getByLabelText("criados: 0")).toBeTruthy();
    expect(screen.getByText(/nada é apagado/i)).toBeTruthy();
    expect(screen.queryByText(/removid[oa]s?|excluíd[oa]s?|reset/i)).toBeNull();
    expect(api.syncHanziHero).toHaveBeenCalledTimes(2);
  });
});
