import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { NuqsAdapter } from "nuqs/adapters/react-router/v6";
import { Toaster } from "./components/ui-kits/toaster/toaster";
import { ThemeProvider } from "./hooks/use-theme";
import QueryProvider from "./providers/query-provider";
// Build log notifications are received via the central NotificationHub (blocks-logic).
// The local DeploymentHub-based listener is paused for now; restore by uncommenting
// both the import and the <DeploymentHubListener /> mount below.
// import { DeploymentHubListener } from "./cross-modules/communication/components/deployment-hub-listener";
import { NotificationHubListener } from "./cross-modules/communication/components/notification-hub-listener";
import { router } from "./router";
import "./styles/globals.css";
import { TooltipProvider } from "./components/ui-kits/tooltip/tooltip";
import { BlocksAppLayout } from "@seliseblocks/blocks-kit";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryProvider>
      <ThemeProvider>
        <TooltipProvider>
          <NuqsAdapter>
            <BlocksAppLayout
              config={{
                userBaseUrlKey: "BLOCKS_IDP_BASE_URL",
                projectBaseUrlKey: "BLOCKS_API_BASE_URL",
              }}
            >
              <RouterProvider router={router} />
            </BlocksAppLayout>
            <Toaster />
            {/* <DeploymentHubListener /> */}
            <NotificationHubListener />
          </NuqsAdapter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryProvider>
  </StrictMode>,
);
