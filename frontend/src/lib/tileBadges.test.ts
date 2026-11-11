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

  it("names each badge in pt-BR and carries a title, with no emoji", () => {
    const [ghost, bolt] = tileBadges(item({ is_leech: true, priority_position: 2 }));
    expect(ghost).toEqual({
      kind: "leech",
      label: "Sanguessuga",
      title: "Sanguessuga — falhas recorrentes",
    });
    expect(bolt).toEqual({
      kind: "priority",
      label: "Prioridade",
      title: "Prioridade — fixado na fila de lições",
    });
  });
});
