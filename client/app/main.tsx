import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { NuqsAdapter } from "nuqs/adapters/react-router/v6";
import { Toaster } from "./components/ui-kits/toaster/toaster";
import { ThemeProvider } from "./hooks/use-theme";
import QueryProvider from "./providers/query-provider";
import { DeploymentHubListener } from "./cross-modules/communication/components/deployment-hub-listener";
import { router } from "./router";
import "./styles/globals.css";
import { TooltipProvider } from "./components/ui-kits/tooltip/tooltip";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryProvider>
      <ThemeProvider>
        <TooltipProvider>
          <NuqsAdapter>
            <RouterProvider router={router} />
            <Toaster />
            <DeploymentHubListener />
          </NuqsAdapter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryProvider>
  </StrictMode>,
);
