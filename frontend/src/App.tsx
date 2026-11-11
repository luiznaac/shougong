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
import { ShellPrototype } from "./prototype/ShellPrototype.tsx";

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
  // Lesson, Review and Practice run full-screen, outside the chrome.
  { path: "/lesson", element: <Lesson /> },
  { path: "/review", element: <Review /> },
  { path: "/practice", element: <Practice /> },
  // Throwaway prototype (wayfinder #105) — not part of the app shell.
  { path: "/prototype/shell", element: <ShellPrototype /> },
];
