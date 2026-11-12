import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StudyOverview } from "../api/types.ts";
import { AppShell } from "./AppShell.tsx";

const OVERVIEW: StudyOverview = {
  new_count: 3,
  due_count: 5,
  due_review_count: 4,
  due_learning_count: 1,
  item_count: 20,
  leech_count: 2,
  srs_distribution: { novice: 1, apprentice: 2, journeyman: 3, expert: 4, master: 5 },
  next_seven_days: [],
  learned: { total: 0, points: [] },
};

function renderShell(initialPath = "/") {
  const router = createMemoryRouter(
    [
      {
        path: "/",
        element: <AppShell />,
        children: [
          { index: true, element: <p>A superfície atual</p> },
          { path: "*", element: <p>A superfície atual</p> },
        ],
      },
    ],
    { initialEntries: [initialPath] },
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => OVERVIEW,
    })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("desktop chrome", () => {
  it("exposes the four global sections and marks the active one", () => {
    renderShell("/biblioteca/adicionar");
    const desktop = within(screen.getByTestId("desktop-top-bar"));
    const nav = within(desktop.getByRole("navigation", { name: "Seções" }));

    for (const label of ["Hoje", "Biblioteca", "Leitura", "Progresso"]) {
      expect(nav.getByRole("link", { name: label })).toBeTruthy();
    }
    expect(nav.getByRole("link", { name: "Biblioteca" }).getAttribute("aria-current")).toBe("page");
    expect(nav.getByRole("link", { name: "Hoje" }).getAttribute("aria-current")).toBeNull();
  });

  it("opens the search destination with the ⌘K shortcut it advertises", async () => {
    const user = userEvent.setup();
    const router = renderShell("/");

    await user.keyboard("{Meta>}k{/Meta}");

    expect(router.state.location.pathname).toBe("/biblioteca");
  });

  it("shows the search affordance, the resume chip and the account chip", async () => {
    renderShell("/");
    const desktop = within(screen.getByTestId("desktop-top-bar"));

    expect(desktop.getByRole("link", { name: "Buscar" })).toBeTruthy();
    expect(desktop.getByRole("link", { name: "Ajustes" })).toBeTruthy();
    const resume = await desktop.findByRole("link", { name: /Retomar\s*5/ });
    expect(resume.getAttribute("href")).toBe("/review");
  });
});

describe("mobile chrome", () => {
  it("exposes Hoje / Biblioteca / Leitura / Mais as bottom tabs", () => {
    renderShell("/");
    const tabBar = within(screen.getByTestId("mobile-tab-bar"));

    for (const label of ["Hoje", "Biblioteca", "Leitura"]) {
      expect(tabBar.getByRole("link", { name: label })).toBeTruthy();
    }
    expect(tabBar.getByRole("button", { name: "Mais" })).toBeTruthy();
    expect(tabBar.queryByRole("link", { name: "Progresso" })).toBeNull();
  });

  it("opens the Mais sheet with Progresso, Adicionar and Ajustes without leaving the page", async () => {
    const user = userEvent.setup();
    const router = renderShell("/");

    await user.click(screen.getByRole("button", { name: "Mais" }));
    const sheet = within(screen.getByRole("menu", { name: "Mais" }));

    expect(sheet.getByRole("menuitem", { name: "Progresso" })).toBeTruthy();
    expect(sheet.getByRole("menuitem", { name: "Adicionar" })).toBeTruthy();
    expect(sheet.getByRole("menuitem", { name: "Ajustes" })).toBeTruthy();
    expect(screen.getByText("A superfície atual")).toBeTruthy();
    expect(router.state.location.pathname).toBe("/");

    await user.click(sheet.getByRole("menuitem", { name: "Adicionar" }));

    expect(router.state.location.pathname).toBe("/biblioteca/adicionar");
    expect(screen.queryByRole("menu", { name: "Mais" })).toBeNull();
  });

  it("closes the Mais sheet with Escape", async () => {
    const user = userEvent.setup();
    renderShell("/");

    await user.click(screen.getByRole("button", { name: "Mais" }));
    expect(screen.getByRole("menu", { name: "Mais" })).toBeTruthy();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("menu", { name: "Mais" })).toBeNull();
  });

  it("pads the top and bottom chrome for the safe areas", () => {
    renderShell("/");

    expect(screen.getByTestId("mobile-top-bar").getAttribute("style")).toContain(
      "env(safe-area-inset-top)",
    );
    expect(screen.getByTestId("mobile-tab-bar").getAttribute("style")).toContain(
      "env(safe-area-inset-bottom)",
    );
  });
});
