import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PriorityActions } from "./PriorityActions.tsx";

function renderActions(overrides: Partial<Parameters<typeof PriorityActions>[0]> = {}) {
  const onRemove = vi.fn();
  render(
    <PriorityActions
      name="學"
      pending={false}
      removeMode="enabled"
      onFront={() => {}}
      onBack={() => {}}
      onRemove={onRemove}
      {...overrides}
    />,
  );
  return { onRemove };
}

describe("PriorityActions", () => {
  it("asks for an inline confirmation before removing a priority", async () => {
    const user = userEvent.setup();
    const { onRemove } = renderActions();

    await user.click(screen.getByRole("button", { name: "Remover prioridade de 學" }));

    expect(screen.getByText("Remover a prioridade de 學?")).toBeTruthy();
    expect(onRemove).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Confirmar remoção de 學" }));

    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("cancels the confirmation without removing anything", async () => {
    const user = userEvent.setup();
    const { onRemove } = renderActions();

    await user.click(screen.getByRole("button", { name: "Remover prioridade de 學" }));
    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onRemove).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Remover prioridade de 學" })).toBeTruthy();
  });
});
