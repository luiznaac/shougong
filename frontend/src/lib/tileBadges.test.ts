import { describe, expect, it } from "vitest";
import { studyItem as item } from "../test/studyItemFixture.ts";
import { tileBadges } from "./tileBadges.ts";

describe("tileBadges", () => {
  it("shows the ghost badge for a leech", () => {
    const badges = tileBadges(item({ is_leech: true }));
    expect(badges.map((b) => b.kind)).toEqual(["leech"]);
  });

  it("shows the bolt badge for a prioritised item", () => {
    const badges = tileBadges(item({ priority_position: 0 }));
    expect(badges.map((b) => b.kind)).toEqual(["priority"]);
  });

  it("shows both, ghost first", () => {
    const badges = tileBadges(item({ is_leech: true, priority_position: -3 }));
    expect(badges.map((b) => b.kind)).toEqual(["leech", "priority"]);
  });

  it("shows neither for an ordinary item", () => {
    expect(tileBadges(item())).toEqual([]);
  });

  it("carries a pt-BR accessible name and a title for each badge", () => {
    const [ghost, bolt] = tileBadges(item({ is_leech: true, priority_position: 2 }));
    expect(ghost).toMatchObject({ emoji: "👻", label: "Sanguessuga" });
    expect(ghost.title).toContain("Sanguessuga");
    expect(bolt).toMatchObject({ emoji: "⚡", label: "Prioridade" });
    expect(bolt.title).toContain("Prioridade");
  });
});
