import { describe, expect, it } from "vitest";
import { studyItem } from "../test/studyItemFixture.ts";
import { orderCharacterTiles } from "./characterPanel.ts";

function item(id: number, stability: number | null) {
  return studyItem({ id, card: { stability } });
}

describe("orderCharacterTiles", () => {
  const all = [item(1, 7), item(2, 120), item(3, 1), item(4, null)];

  it("orders `Todas` by stability, descending", () => {
    expect(orderCharacterTiles("all", { all, leeches: [] }).map((i) => i.id)).toEqual([2, 1, 3, 4]);
  });

  it("keeps the server's worst-first order for `Sanguessugas`", () => {
    const leeches = [item(9, 2), item(5, 90), item(7, 1)];
    expect(orderCharacterTiles("leeches", { all, leeches }).map((i) => i.id)).toEqual([9, 5, 7]);
  });

  it("never mutates the received lists", () => {
    const received = [item(1, 7), item(2, 120)];
    orderCharacterTiles("all", { all: received, leeches: [] });
    expect(received.map((i) => i.id)).toEqual([1, 2]);
  });
});
