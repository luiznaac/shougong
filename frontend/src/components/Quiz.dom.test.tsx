import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { studyItem } from "../test/studyItemFixture.ts";
import { Quiz } from "./Quiz.tsx";

function renderQuiz() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Quiz
          items={[studyItem()]}
          mode="review"
          emptyMessage="Nada para praticar neste período."
          record={false}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

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

    await user.click(screen.getByRole("button", { name: /Rollback/ }));

    expect((screen.getByRole("button", { name: /Próximo/ }) as HTMLButtonElement).disabled).toBe(
      true,
    );
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
});
