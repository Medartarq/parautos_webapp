import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./app";
import { PublicTracking } from "./public-tracking";
import "./styles.css";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {window.location.pathname === "/seguimiento" ? <PublicTracking /> : <App />}
    </QueryClientProvider>
  </StrictMode>
);
