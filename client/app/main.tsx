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
import { getRuntimeEnv } from "./lib/runtime-env";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryProvider>
      {/* <ThemeProvider> */}
        <NuqsAdapter>
          <TooltipProvider>
            <BlocksAppLayout
              config={{
                name: "blocks-release",
                userBaseUrlKey: "BLOCKS_IDP_BASE_URL",
                // Projects are owned by the logic app, so blocks-kit's ConsolePage
                // (useGetProjects) must read the logic base URL, not the deployment
                // API (which is the current origin / dev-release).
                projectBaseUrlKey: "BLOCKS_LOGIC_BASE_URL",
                appLogoUrl:{
                  dark: "/Logo_Dark.svg",
                  light: "/Logo_Light.svg",
                }
              }}
            >
              <RouterProvider router={router} />
            </BlocksAppLayout>
            <Toaster />
            {/* <DeploymentHubListener /> */}
            <NotificationHubListener />
          </TooltipProvider>
        </NuqsAdapter>
      {/* </ThemeProvider> */}
    </QueryProvider>
  </StrictMode>,
);
