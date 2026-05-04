import { BlocksAppLauncher } from "@/components/blocks-app-launcher/blocks-app-launcher";
import { EnvironmentList } from "@/components/environment-list/environment-list";
import { LanguageSelector } from "@/components/language-selector/language-selector";
import { ModeToggle } from "@/components/mode-toggle/mode-toggle";
import { Notification } from "@/components/notification/notification";
import { ProjectList } from "@/components/project-list/project-list";
import { Button } from "@/components/ui-kits/button/button";
import { UserDropdownMenu } from "@/components/user-dropdown-menu/user-dropdown-menu";
import { SidebarContext } from "@/contexts/dashboard-layout-provider";
import { SidebarMobileView } from "@/layouts/sidebar-mobile-view/sidebar-mobile-view";
import { cn } from "@/lib/utils";
import { PanelLeft } from "lucide-react";
import { useContext } from "react";

export function DashboardHeader() {
  const { isSidebarOpen, toggleSidebar } = useContext(SidebarContext);

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
            className={cn("hidden shrink-0 p-0", !isSidebarOpen && "inline-flex")}
            onClick={toggleSidebar}
          >
            <PanelLeft className="h-6 w-6" />
          </Button>
          <div className="w-52">
            <ProjectList />
          </div>
        </div>

        <div className="relative z-50 flex items-center gap-4">
          <div className="hidden h-fit w-fit-content md:flex">
            <EnvironmentList />
          </div>
          <div className="pointer-events-auto flex items-center">
            <ModeToggle />
          </div>
          <div className="pointer-events-auto flex items-center">
            <Notification />
          </div>
          <div className="pointer-events-auto flex items-center">
            <LanguageSelector />
          </div>
          <div className="pointer-events-auto flex items-center">
            <BlocksAppLauncher />
          </div>
          <div className="pointer-events-auto flex items-center">
            <UserDropdownMenu />
          </div>
        </div>
      </header>
      {/* Mobile project/environment selectors */}
      <div className="border-b bg-background px-5 sm:px-6 py-3 md:hidden">
        <div className="grid gap-3">
          <ProjectList />
          <EnvironmentList />
        </div>
      </div>
    </>
  );
}
