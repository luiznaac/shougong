import type { RouteObject } from "react-router-dom";
import { Layout } from "./components/Layout.tsx";
import { Dashboard } from "./pages/Dashboard.tsx";
import { Review } from "./pages/Review.tsx";
import { Lesson } from "./pages/Lesson.tsx";
import { StudyItemPage } from "./pages/StudyItemPage.tsx";
import { AddItems } from "./pages/AddItems.tsx";
import { BatchImport } from "./pages/BatchImport.tsx";

export const routes: RouteObject[] = [
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "add", element: <AddItems /> },
      { path: "add/batch", element: <BatchImport /> },
      { path: "items/:id", element: <StudyItemPage /> },
    ],
  },
  // Lesson and Review run full-screen, outside the chrome.
  { path: "/lesson", element: <Lesson /> },
  { path: "/review", element: <Review /> },
];
