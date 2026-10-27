import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./query-client";
import { App } from "./app";
import { PublicTracking } from "./public-tracking";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {window.location.pathname === "/seguimiento" ? <PublicTracking /> : <App />}
    </QueryClientProvider>
  </StrictMode>
);
