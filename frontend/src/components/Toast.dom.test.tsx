import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Toast } from "./Toast.tsx";

describe("Toast", () => {
  it("runs its undo action", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<Toast message="Item removido" actionLabel="Desfazer" onAction={onAction} />);

    await user.click(screen.getByRole("button", { name: "Desfazer" }));

    expect(onAction).toHaveBeenCalledOnce();
  });

  it("can be dismissed", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<Toast message="Item removido" onDismiss={onDismiss} />);

    await user.click(screen.getByRole("button", { name: "Fechar aviso" }));

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("announces itself politely", () => {
    render(<Toast message="Item removido" />);
    expect(screen.getByRole("status").textContent).toContain("Item removido");
  });
});
