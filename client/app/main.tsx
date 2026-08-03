import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import { NuqsAdapter } from "nuqs/adapters/react-router/v8";
import { Toaster } from "./components/ui-kits/toaster/toaster";
import { ThemeProvider } from "./hooks/use-theme";
import QueryProvider from "./providers/query-provider";
import { NotificationHubListener } from "./cross-modules/communication/components/notification-hub-listener";
import { router } from "./router";
import "./styles/globals.css";
import { TooltipProvider } from "./components/ui-kits/tooltip/tooltip";
import { BlocksAppLayout } from "@seliseblocks/genesis-os";
import { getRuntimeEnv } from "./lib/runtime-env";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryProvider>
      <ThemeProvider>
        <NuqsAdapter>
          <TooltipProvider>
            <BlocksAppLayout
              config={{
                name: "blocks-release",
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
      </ThemeProvider>
    </QueryProvider>
  </StrictMode>,
);
