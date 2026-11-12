import { describe, expect, it } from "vitest";
import {
  MAIS_ITEMS,
  MOBILE_TABS,
  SECTIONS,
  isActiveSection,
  isMaisTabActive,
} from "./navigation.ts";

describe("global sections", () => {
  it("lists Hoje, Biblioteca, Leitura and Progresso in order", () => {
    expect(SECTIONS.map((s) => s.label)).toEqual(["Hoje", "Biblioteca", "Leitura", "Progresso"]);
    expect(SECTIONS.map((s) => s.to)).toEqual(["/", "/biblioteca", "/leitura", "/progresso"]);
  });
});

describe("mobile tabs", () => {
  it("keeps Hoje, Biblioteca and Leitura and moves Progresso to Mais", () => {
    expect(MOBILE_TABS.map((s) => s.label)).toEqual(["Hoje", "Biblioteca", "Leitura"]);
    expect(MAIS_ITEMS.map((i) => i.label)).toEqual(["Progresso", "Adicionar", "Ajustes"]);
    expect(MAIS_ITEMS.map((i) => i.to)).toEqual([
      "/progresso",
      "/biblioteca/adicionar",
      "/ajustes",
    ]);
  });
});

describe("isActiveSection", () => {
  it("matches a section on its own path and its children", () => {
    expect(isActiveSection("/biblioteca", "/biblioteca")).toBe(true);
    expect(isActiveSection("/biblioteca", "/biblioteca/itens/5")).toBe(true);
    expect(isActiveSection("/biblioteca", "/bibliotecas")).toBe(false);
  });

  it("matches Hoje only at the root", () => {
    expect(isActiveSection("/", "/")).toBe(true);
    expect(isActiveSection("/", "/leitura")).toBe(false);
  });
});

describe("isMaisTabActive", () => {
  it("is active only for the destinations that live in the Mais sheet", () => {
    expect(isMaisTabActive("/progresso")).toBe(true);
    expect(isMaisTabActive("/ajustes")).toBe(true);
    expect(isMaisTabActive("/biblioteca/adicionar")).toBe(false);
    expect(isMaisTabActive("/")).toBe(false);
  });
});
