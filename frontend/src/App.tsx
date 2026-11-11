import type { RouteObject } from "react-router-dom";
import { Layout } from "./components/Layout.tsx";
import { AddItems } from "./pages/AddItems.tsx";
import { BatchImport } from "./pages/BatchImport.tsx";
import { Dashboard } from "./pages/Dashboard.tsx";
import { Lesson } from "./pages/Lesson.tsx";
import { Practice } from "./pages/Practice.tsx";
import { Reading } from "./pages/Reading.tsx";
import { Review } from "./pages/Review.tsx";
import { StudyItemPage } from "./pages/StudyItemPage.tsx";
import { AddImportPrototype } from "./prototype/AddImportPrototype.tsx";
import { ItemDetailPrototype } from "./prototype/ItemDetailPrototype.tsx";
import { ReadingPrototype } from "./prototype/ReadingPrototype.tsx";

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "add", element: <AddItems /> },
      { path: "add/batch", element: <BatchImport /> },
      { path: "items/:id", element: <StudyItemPage /> },
      { path: "reading", element: <Reading /> },
    ],
  },
  // Throwaway wayfinder prototype (#108) — not for merge.
  { path: "/prototype/add-import", element: <AddImportPrototype /> },
  // Throwaway wayfinder prototype (#109) — not for merge.
  { path: "/prototype/reading", element: <ReadingPrototype /> },
  // Throwaway wayfinder prototype (#110) — not for merge.
  { path: "/prototype/item-detail", element: <ItemDetailPrototype /> },
  // Lesson, Review and Practice run full-screen, outside the chrome.
  { path: "/lesson", element: <Lesson /> },
  { path: "/review", element: <Review /> },
  { path: "/practice", element: <Practice /> },
];
