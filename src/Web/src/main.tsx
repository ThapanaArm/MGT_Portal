import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import App from "@/app/App";
import "@/styles/globals.css";
import "@/styles/portal.css";

const router = createBrowserRouter([{ path: "*", element: <App /> }]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
import "@/styles/components.css";
import "@/styles/workspace.css";
import "@/styles/governance.css";
import "@/styles/color-refresh.css";
import "@/styles/motion.css";
import "@/styles/banner.css";

