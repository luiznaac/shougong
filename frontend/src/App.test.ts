import { isValidElement } from "react";
import type { RouteObject } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { routes } from "./App.tsx";
import { AppShell } from "./components/AppShell.tsx";
import { Placeholder } from "./components/Placeholder.tsx";
import { AddItems } from "./pages/AddItems.tsx";
import { BatchImport } from "./pages/BatchImport.tsx";
import { ItemIndex } from "./pages/ItemIndex.tsx";
import { Lesson } from "./pages/Lesson.tsx";
import { Practice } from "./pages/Practice.tsx";
import { Reading } from "./pages/Reading.tsx";
import { Review } from "./pages/Review.tsx";
import { StudyItemPage } from "./pages/StudyItemPage.tsx";

function elementType(element: RouteObject["element"]) {
  return isValidElement(element) ? element.type : null;
}

const shell = routes.find((route) => route.path === "/");
const shellChildren = shell?.children ?? [];
const child = (path: string) => shellChildren.find((route) => route.path === path);

describe("route table", () => {
  it("nests every chrome destination under the app shell", () => {
    expect(elementType(shell?.element)).toBe(AppShell);
    expect(shellChildren.some((route) => route.index)).toBe(true);

    for (const path of [
      "biblioteca",
      "biblioteca/itens/:id",
      "biblioteca/adicionar",
      "biblioteca/importar",
      "leitura",
      "progresso",
      "ajustes",
    ]) {
      expect(child(path)).toBeDefined();
    }
  });

  it("moves the migrated surfaces onto their new IA paths", () => {
    expect(elementType(child("biblioteca")?.element)).toBe(ItemIndex);
    expect(elementType(child("biblioteca/adicionar")?.element)).toBe(AddItems);
    expect(elementType(child("biblioteca/importar")?.element)).toBe(BatchImport);
    expect(elementType(child("biblioteca/itens/:id")?.element)).toBe(StudyItemPage);
    expect(elementType(child("leitura")?.element)).toBe(Reading);
  });

  it("renders the one shared placeholder on surfaces that have not migrated", () => {
    for (const path of ["progresso", "ajustes"]) {
      expect(elementType(child(path)?.element)).toBe(Placeholder);
    }
  });

  it("keeps Lesson, Review and Practice full-screen outside the shell", () => {
    const fullScreen = [
      ["/lesson", Lesson],
      ["/review", Review],
      ["/practice", Practice],
    ] as const;

    for (const [path, page] of fullScreen) {
      const route = routes.find((entry) => entry.path === path);
      expect(elementType(route?.element)).toBe(page);
      expect(shellChildren.some((entry) => entry.path === path.slice(1))).toBe(false);
    }
  });

  it("retires the old navigation paths", () => {
    const allPaths = routes.flatMap((route) => [
      route.path,
      ...(route.children ?? []).map((nested) => nested.path),
    ]);
    for (const oldPath of ["/add", "/add/batch", "/items/:id", "/reading"]) {
      expect(allPaths).not.toContain(oldPath);
    }
  });
});
