import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LoadMore } from "./LoadMore.tsx";

describe("LoadMore", () => {
  it("shows the honest shown-of-total caption and a load-more button", () => {
    render(<LoadMore shown={24} total={137} onLoadMore={() => {}} />);

    expect(screen.getByText("Mostrando 24 de 137")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Carregar mais" })).toBeTruthy();
  });

  it("reports a load-more request", async () => {
    const user = userEvent.setup();
    const onLoadMore = vi.fn();
    render(<LoadMore shown={48} total={137} onLoadMore={onLoadMore} />);

    await user.click(screen.getByRole("button", { name: "Carregar mais" }));

    expect(onLoadMore).toHaveBeenCalledOnce();
  });

  it("drops the button once every row is shown", () => {
    render(<LoadMore shown={137} total={137} onLoadMore={() => {}} />);

    expect(screen.getByText("Mostrando 137 de 137")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Carregar mais" })).toBeNull();
  });

  it("disables the button while the next page is loading", () => {
    render(<LoadMore shown={24} total={137} loading onLoadMore={() => {}} />);

    expect(
      (screen.getByRole("button", { name: "Carregar mais" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
