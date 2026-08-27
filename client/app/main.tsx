import "@seliseblocks/genesis-os/lib";
import "@/styles/globals.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import { NuqsAdapter } from "nuqs/adapters/react-router/v8";
import {
  RollbarProvider,
  attachQueryErrorReporting,
  getRollbar,
} from "@seliseblocks/genesis-os/observability";
import { Toaster } from "@/components/ui-kits/toaster/toaster";
import { ThemeProvider } from "@/hooks/use-theme";
import QueryProvider, { getQueryClient } from "@/providers/query-provider";
import { NotificationHubListener } from "@/cross-modules/communication/components/notification-hub-listener";
import { router } from "@/router";
import { TooltipProvider } from "@/components/ui-kits/tooltip/tooltip";
import { SERVICE_NAME } from "@/constants/service.constant";
import { BlocksAppLayout } from "@seliseblocks/genesis-os";

// RollbarProvider wires query-error reporting to the query client owned by
// @seliseblocks/genesis-os. This app keeps its own singleton, so bugs thrown inside its query and
// mutation functions -- which React Query stores as state and never rethrows to window.onerror --
// need the reporter attached to that client explicitly.
attachQueryErrorReporting(getQueryClient(), getRollbar({ service: SERVICE_NAME }));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RollbarProvider service={SERVICE_NAME}>
      <QueryProvider>
        <ThemeProvider>
          <NuqsAdapter>
            <TooltipProvider>
              <BlocksAppLayout
                config={{
                  name: "blocks-release",
                  appLogoUrl: {
                    dark: "/Logo_Dark.svg",
                    light: "/Logo_Light.svg",
                  },
                }}
              >
                <RouterProvider router={router} />
              </BlocksAppLayout>
              <Toaster />
              <NotificationHubListener />
            </TooltipProvider>
          </NuqsAdapter>
        </ThemeProvider>
      </QueryProvider>
    </RollbarProvider>
  </StrictMode>,
);
