import type { IconName } from "../components/icons.tsx";

// The app's one navigation model. Desktop renders SECTIONS, mobile renders
// MOBILE_TABS plus a Mais button, and the Mais sheet renders MAIS_ITEMS — every
// chrome reads this file instead of hard-coding a destination twice.

/** Every chrome destination, in one place. A rename edits this object only. */
export const PATHS = {
  hoje: "/",
  biblioteca: "/biblioteca",
  bibliotecaAdicionar: "/biblioteca/adicionar",
  bibliotecaImportar: "/biblioteca/importar",
  leitura: "/leitura",
  progresso: "/progresso",
  ajustes: "/ajustes",
  /** The resume chip opens the review session. */
  retomar: "/review",
} as const;

/** A study item's detail page, the one route built from an id. */
export function itemPath(id: number): string {
  return `${PATHS.biblioteca}/itens/${id}`;
}

export type SectionId = "hoje" | "biblioteca" | "leitura" | "progresso";

export interface NavSection {
  id: SectionId;
  label: string;
  to: string;
  icon: IconName;
}

export const SECTIONS: NavSection[] = [
  { id: "hoje", label: "Hoje", to: PATHS.hoje, icon: "home" },
  { id: "biblioteca", label: "Biblioteca", to: PATHS.biblioteca, icon: "book" },
  { id: "leitura", label: "Leitura", to: PATHS.leitura, icon: "text" },
  { id: "progresso", label: "Progresso", to: PATHS.progresso, icon: "chart" },
];

/** Desktop sections that become bottom tabs on mobile; Progresso lives in Mais. */
export const MOBILE_TABS: NavSection[] = SECTIONS.filter((section) => section.id !== "progresso");

export interface MaisItem {
  label: string;
  to: string;
  icon: IconName;
}

export const ADICIONAR: MaisItem = {
  label: "Adicionar",
  to: PATHS.bibliotecaAdicionar,
  icon: "plus",
};

export const AJUSTES: MaisItem = { label: "Ajustes", to: PATHS.ajustes, icon: "sliders" };

/** The mobile overflow sheet. CSV import is deliberately absent (desktop-only). */
export const MAIS_ITEMS: MaisItem[] = [
  { label: "Progresso", to: PATHS.progresso, icon: "chart" },
  ADICIONAR,
  AJUSTES,
];

// The Mais tab is the active tab only when the current route is one of its own
// destinations; `/biblioteca/adicionar` stays under the Biblioteca tab.
const MAIS_OWN_PATHS = [PATHS.progresso, PATHS.ajustes];

/** A section matches its own path and any child route, on a segment boundary. */
export function isActiveSection(to: string, pathname: string): boolean {
  if (to === "/") return pathname === "/";
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function isMaisTabActive(pathname: string): boolean {
  return MAIS_OWN_PATHS.some((path) => isActiveSection(path, pathname));
}
