import type { RouteObject } from "react-router-dom";
import { AppShell } from "./components/AppShell.tsx";
import { Placeholder } from "./components/Placeholder.tsx";
import { AddItems } from "./pages/AddItems.tsx";
import { BatchImport } from "./pages/BatchImport.tsx";
import { Dashboard } from "./pages/Dashboard.tsx";
import { Lesson } from "./pages/Lesson.tsx";
import { Practice } from "./pages/Practice.tsx";
import { Reading } from "./pages/Reading.tsx";
import { Review } from "./pages/Review.tsx";
import { StudyItemPage } from "./pages/StudyItemPage.tsx";

// Hoje / Biblioteca / Leitura / Progresso, with Ajustes behind the account chip
// and the mobile Mais sheet. Surfaces that have not migrated yet render the one
// shared Placeholder; their own tickets replace that usage outright.
export const routes: RouteObject[] = [
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <Dashboard /> },
      {
        path: "biblioteca",
        element: (
          <Placeholder
            title="Itens"
            description="A lista completa de itens de estudo chega na próxima etapa da reformulação."
            links={[
              { label: "Adicionar", to: "/biblioteca/adicionar" },
              { label: "Importar CSV", to: "/biblioteca/importar" },
            ]}
          />
        ),
      },
      { path: "biblioteca/itens/:id", element: <StudyItemPage /> },
      { path: "biblioteca/adicionar", element: <AddItems /> },
      { path: "biblioteca/importar", element: <BatchImport /> },
      { path: "leitura", element: <Reading /> },
      {
        path: "progresso",
        element: (
          <Placeholder
            title="Progresso"
            description="Cobertura de HSK, perfil de vocabulário e a curva de aprendizado chegam em breve."
          />
        ),
      },
      {
        path: "ajustes",
        element: (
          <Placeholder
            title="Ajustes"
            description="As configurações de escrita à mão chegam em breve."
          />
        ),
      },
    ],
  },
  // Lesson, Review and Practice run full-screen, outside the chrome.
  { path: "/lesson", element: <Lesson /> },
  { path: "/review", element: <Review /> },
  { path: "/practice", element: <Practice /> },
];
