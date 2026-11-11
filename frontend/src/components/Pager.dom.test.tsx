import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Pager } from "./Pager.tsx";

function pageButton(name: string) {
  return screen.getByRole("button", { name }) as HTMLButtonElement;
}

describe("Pager", () => {
  it("shows numbered pages and the honest shown-of-total caption", () => {
    render(<Pager page={1} total={137} shown={24} pageSize={24} onPageChange={() => {}} />);

    expect(screen.getByText("Mostrando 24 de 137")).toBeTruthy();
    for (const n of [1, 2, 3, 4, 5, 6]) {
      expect(pageButton(`Página ${n}`)).toBeTruthy();
    }
  });

  it("disables previous on the first page and next on the last", () => {
    const { rerender } = render(
      <Pager page={1} total={137} shown={24} pageSize={24} onPageChange={() => {}} />,
    );
    expect(pageButton("Página anterior").disabled).toBe(true);
    expect(pageButton("Próxima página").disabled).toBe(false);

    rerender(<Pager page={6} total={137} shown={137} pageSize={24} onPageChange={() => {}} />);
    expect(pageButton("Página anterior").disabled).toBe(false);
    expect(pageButton("Próxima página").disabled).toBe(true);
    expect(screen.getByText("Mostrando 137 de 137")).toBeTruthy();
  });

  it("reports a chosen page and the neighbours of the current one", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pager page={2} total={137} shown={48} pageSize={24} onPageChange={onPageChange} />);

    await user.click(pageButton("Página 4"));
    await user.click(pageButton("Próxima página"));
    await user.click(pageButton("Página anterior"));

    expect(onPageChange.mock.calls).toEqual([[4], [3], [1]]);
  });

  it("windows a long list around the current page, keeping both ends", () => {
    render(<Pager page={10} total={300} shown={240} pageSize={24} onPageChange={() => {}} />);

    expect(pageButton("Página 1")).toBeTruthy();
    expect(pageButton("Página 13")).toBeTruthy();
    expect(pageButton("Página 8")).toBeTruthy();
    expect(pageButton("Página 12")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Página 5" })).toBeNull();
    expect(screen.getAllByText("…")).toHaveLength(1);
  });

  it("honours a caller's per-surface page size for the page count", () => {
    render(<Pager page={1} total={142} shown={5} pageSize={5} onPageChange={() => {}} />);

    expect(pageButton("Página 29")).toBeTruthy();
  });
});
