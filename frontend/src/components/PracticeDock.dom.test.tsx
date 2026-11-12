import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PracticeDock } from "./PracticeDock.tsx";

function dock(overrides: Partial<Parameters<typeof PracticeDock>[0]> = {}) {
  const props = {
    presentation: "desktop" as const,
    revealed: true,
    selected: null,
    canRollback: true,
    canNext: false,
    submitting: false,
    nextLabel: "Próximo",
    onSelect: vi.fn(),
    onRollback: vi.fn(),
    onNext: vi.fn(),
    ...overrides,
  };
  render(<PracticeDock {...props} />);
  return props;
}

describe("PracticeDock", () => {
  it("renders the four note keys with their hints and hotkeys", () => {
    dock();

    for (const [label, hint, hotkey] of [
      ["Errei", "reaprende agora", "1"],
      ["Difícil", "volta em ~1 dia", "2"],
      ["Bom", "volta em ~3 dias", "3"],
      ["Fácil", "volta em ~7 dias", "4"],
    ]) {
      const key = screen.getByRole("button", { name: new RegExp(label) });
      expect(key.textContent).toContain(hint);
      expect(key.textContent).toContain(hotkey);
    }
  });

  it("reports the chosen note and recedes only the label of the others", async () => {
    const user = userEvent.setup();
    const props = dock({ selected: "good" });

    expect(screen.getByRole("button", { name: /^Bom/ }).getAttribute("aria-pressed")).toBe("true");
    for (const label of ["Errei", "Difícil", "Fácil"]) {
      expect(
        screen.getByRole("button", { name: new RegExp(label) }).getAttribute("aria-pressed"),
      ).toBe("false");
    }

    await user.click(screen.getByRole("button", { name: /^Fácil/ }));
    expect(props.onSelect).toHaveBeenCalledWith("easy");
  });

  it("keeps the note keys inert until the answer is revealed", () => {
    dock({ revealed: false });

    for (const label of ["Errei", "Difícil", "Bom", "Fácil"]) {
      expect(
        (screen.getByRole("button", { name: new RegExp(label) }) as HTMLButtonElement).disabled,
      ).toBe(true);
    }
  });

  it("wires rollback and the disabled advance on desktop", async () => {
    const user = userEvent.setup();
    const props = dock();

    expect((screen.getByRole("button", { name: /Próximo/ }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    await user.click(screen.getByRole("button", { name: /Rollback/ }));
    expect(props.onRollback).toHaveBeenCalled();
  });

  it("moves rollback out of the mobile dock and keeps a full-width advance", () => {
    dock({ presentation: "mobile" });

    expect(screen.queryByRole("button", { name: /Rollback/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Próximo/ })).toBeTruthy();
  });
});
