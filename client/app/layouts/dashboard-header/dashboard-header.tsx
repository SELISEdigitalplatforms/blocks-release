import { BackToConsoleNavigator } from "@/components/back-to-console-navigator";
// Replaced by blocks-kit package components (AppSwitcher / ThemeSwitcher / UserDropdownMenu).
// Local references kept commented for reference.
// import { BlocksAppLauncher } from "@/components/blocks-app-launcher/blocks-app-launcher";
import { SelectedEnvironment } from "@/components/environment-list/selected-environment";
import { LanguageSelector } from "@/components/language-selector/language-selector";
// import { ModeToggle } from "@/components/mode-toggle/mode-toggle";
import { Notification } from "@blocks-communication/components/notification/notification";
import { SelectedProject } from "@/components/project-list/selected-project";
import { Button } from "@/components/ui-kits/button/button";
// import { UserDropdownMenu } from "@/components/user-dropdown-menu/user-dropdown-menu";
import { AppSwitcher, ThemeSwitcher, UserDropdownMenu } from "@seliseblocks/blocks-kit";
import { SidebarContext } from "@/contexts/dashboard-layout-provider";
import { SidebarMobileView } from "@/layouts/sidebar-mobile-view/sidebar-mobile-view";
import { useProjectStore } from "@/store/project.store.ts";
import { cn } from "@/lib/utils";
import { ChevronRight, PanelLeft } from "lucide-react";
import { useContext } from "react";
import { useLocation } from "react-router-dom";

export function DashboardHeader() {
  const { isSidebarOpen, toggleSidebar } = useContext(SidebarContext);
  const { pathname } = useLocation();
  const { selectedProject } = useProjectStore();
  const projectName = selectedProject?.name;
  const environment = selectedProject?.environment;
  const isProjectOverviewRoute = pathname.startsWith("/project-overview");

  return (
    <>
      <header className="relative z-40 flex h-[60px] items-center justify-between gap-4 border-b bg-background px-5 sm:px-6">
        <div className="md:hidden">
          <SidebarMobileView />
        </div>

        <div className="hidden items-center md:flex">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "hidden shrink-0 p-0",
              !isSidebarOpen && "inline-flex",
            )}
            onClick={toggleSidebar}>
            <PanelLeft className="h-6 w-6" />
          </Button>
          {!isProjectOverviewRoute &&
            !isSidebarOpen &&
            (projectName || environment) && (
              <div className="ml-3 flex min-w-0 items-center gap-1.5">
                <SelectedProject />
                {projectName && environment && (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                <SelectedEnvironment />
              </div>
            )}
        </div>

        <div className="relative z-50 flex items-center gap-4">
          <BackToConsoleNavigator />
          <div className="pointer-events-auto flex items-center">
            <ThemeSwitcher />
          </div>
          <div className="pointer-events-auto flex items-center">
            <Notification />
          </div>
          <div className="pointer-events-auto flex items-center">
            <LanguageSelector />
          </div>
          <div className="pointer-events-auto flex items-center">
            <AppSwitcher forwardedTo="/console" />
          </div>
          <div className="pointer-events-auto flex items-center">
            <UserDropdownMenu />
          </div>
        </div>
      </header>
      {/* Mobile project/environment selectors */}
      {!isProjectOverviewRoute && (projectName || environment) && (
        <div className="border-b bg-background px-5 py-3 sm:px-6 md:hidden">
          <div className="flex flex-col gap-2">
            <SelectedProject />
            <SelectedEnvironment />
          </div>
        </div>
      )}
    </>
  );
}
