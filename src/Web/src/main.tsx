import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "@/app/App";
import "@/styles/globals.css";
import "@/styles/portal.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
import "@/styles/components.css";
import "@/styles/workspace.css";
import "@/styles/governance.css";
import "@/styles/color-refresh.css";
