import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { Ajustes } from "./Ajustes.tsx";

const ENABLED_KEY = "shougong.handwriting.enabled";
const TOLERANCE_KEY = "shougong.handwriting.tolerancePercent";

beforeEach(() => {
  localStorage.clear();
});

describe("Ajustes", () => {
  it("exposes the handwriting toggle and its tolerance preset, off by default", () => {
    render(<Ajustes />);

    const toggle = screen.getByRole("checkbox", { name: "Checagem de escrita à mão" });
    const tolerance = screen.getByLabelText("Tolerância de erros") as HTMLSelectElement;

    expect((toggle as HTMLInputElement).checked).toBe(false);
    expect(tolerance.disabled).toBe(true);
    expect(tolerance.value).toBe("0");
  });

  it("enables the tolerance preset with the toggle and shows the allowed mistake count", async () => {
    const user = userEvent.setup();
    render(<Ajustes />);

    await user.click(screen.getByRole("checkbox", { name: "Checagem de escrita à mão" }));
    const tolerance = screen.getByLabelText("Tolerância de erros") as HTMLSelectElement;
    expect(tolerance.disabled).toBe(false);

    await user.selectOptions(tolerance, "30");
    expect(screen.getByText(/1 erro permitido em um caractere de 6 traços/)).toBeTruthy();
  });

  it("persists both settings across a reload and reads them back", async () => {
    const user = userEvent.setup();
    const first = render(<Ajustes />);

    await user.click(screen.getByRole("checkbox", { name: "Checagem de escrita à mão" }));
    await user.selectOptions(screen.getByLabelText("Tolerância de erros"), "40");

    expect(localStorage.getItem(ENABLED_KEY)).toBe("true");
    expect(localStorage.getItem(TOLERANCE_KEY)).toBe("40");

    first.unmount();
    render(<Ajustes />);

    expect(
      (screen.getByRole("checkbox", { name: "Checagem de escrita à mão" }) as HTMLInputElement)
        .checked,
    ).toBe(true);
    expect((screen.getByLabelText("Tolerância de erros") as HTMLSelectElement).value).toBe("40");
  });

  it("keeps the stored tolerance when the check is turned off", async () => {
    const user = userEvent.setup();
    render(<Ajustes />);

    const toggle = screen.getByRole("checkbox", { name: "Checagem de escrita à mão" });
    await user.click(toggle);
    await user.selectOptions(screen.getByLabelText("Tolerância de erros"), "20");
    await user.click(toggle);

    expect(localStorage.getItem(ENABLED_KEY)).toBe("false");
    expect(localStorage.getItem(TOLERANCE_KEY)).toBe("20");
    expect((screen.getByLabelText("Tolerância de erros") as HTMLSelectElement).disabled).toBe(true);
  });
});
