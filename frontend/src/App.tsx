import type { RouteObject } from "react-router-dom";
import { AppShell } from "./components/AppShell.tsx";
import { AddItems } from "./pages/AddItems.tsx";
import { Ajustes } from "./pages/Ajustes.tsx";
import { BatchImport } from "./pages/BatchImport.tsx";
import { Dashboard } from "./pages/Dashboard.tsx";
import { ItemIndex } from "./pages/ItemIndex.tsx";
import { Lesson } from "./pages/Lesson.tsx";
import { Practice } from "./pages/Practice.tsx";
import { Progresso } from "./pages/Progresso.tsx";
import { Reading } from "./pages/Reading.tsx";
import { Review } from "./pages/Review.tsx";
import { StudyItemPage } from "./pages/StudyItemPage.tsx";

// Hoje / Biblioteca / Leitura / Progresso, with Ajustes behind the account chip
// and the mobile Mais sheet.
export const routes: RouteObject[] = [
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <Dashboard /> },
      {
        path: "biblioteca",
        element: <ItemIndex />,
      },
      { path: "biblioteca/itens/:id", element: <StudyItemPage /> },
      { path: "biblioteca/adicionar", element: <AddItems /> },
      { path: "biblioteca/importar", element: <BatchImport /> },
      { path: "leitura", element: <Reading /> },
      { path: "progresso", element: <Progresso /> },
      { path: "ajustes", element: <Ajustes /> },
    ],
  },
  // Lesson, Review and Practice run full-screen, outside the chrome.
  { path: "/lesson", element: <Lesson /> },
  { path: "/review", element: <Review /> },
  { path: "/practice", element: <Practice /> },
];
