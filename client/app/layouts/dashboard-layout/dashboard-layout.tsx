import { ErrorBoundary } from "@/components/error-boundary";
import { DashboardLayoutProvider } from "@/contexts/dashboard-layout-provider";
import {
  ImpersonationChecker,
  ImpersonationSynchronizer,
  ProtectedGuard,
} from "@/guards/protected-guard";
import { DashboardHeader } from "@/layouts/dashboard-header/dashboard-header";
import { SidebarMenuDesktop } from "@/layouts/sidebar-menu-desktop/sidebar-menu-desktop";
import { Outlet } from "react-router-dom";

export function DashboardLayout() {
  return (
    <ProtectedGuard>
      <ImpersonationChecker>
        <ImpersonationSynchronizer>
          <DashboardLayoutProvider isOpen={true} persist>
            <div className="relative flex h-screen overflow-hidden bg-[hsl(var(--surface-app))]">
              <SidebarMenuDesktop />
              <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
                <DashboardHeader />
                <main className="relative flex-1 overflow-auto p-2 sm:p-4 lg:p-6">
                  <ErrorBoundary>
                    <Outlet />
                  </ErrorBoundary>
                </main>
              </div>
            </div>
          </DashboardLayoutProvider>
        </ImpersonationSynchronizer>
      </ImpersonationChecker>
    </ProtectedGuard>
  );
}
