import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { studyItem } from "../test/studyItemFixture.ts";
import { CharacterTileGrid } from "./CharacterTileGrid.tsx";

describe("CharacterTileGrid", () => {
  it("renders one tile per item and no load-more tile without a handler", () => {
    render(
      <MemoryRouter>
        <CharacterTileGrid items={[studyItem({ id: 1 }), studyItem({ id: 2 })]} />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /Carregar mais caracteres/ })).toBeNull();
  });

  it("appends a '+' tile that asks for the next page when a handler is given", async () => {
    const user = userEvent.setup();
    const onLoadMore = vi.fn();
    render(
      <MemoryRouter>
        <CharacterTileGrid items={[studyItem({ id: 1 })]} onLoadMore={onLoadMore} />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: /Carregar mais caracteres/ }));

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });
});
