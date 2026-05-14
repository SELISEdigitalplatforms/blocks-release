import { Logo } from "@/components/logo";
import { DesktopMenuItem } from "@/components/menus/desktop-menu-item";
import { Button } from "@/components/ui-kits/button/button";
import { Separator } from "@/components/ui-kits/separator/separator";
import { navigationMenus } from "@/constants/navigation-menus.constant";
import { SidebarContext } from "@/contexts/dashboard-layout-provider";
import { useFilteredMenus } from "@/hooks/use-filtered-menus";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import { PanelLeft } from "lucide-react";
import { Fragment, useContext } from "react";

export function SidebarMenuDesktop() {
  const { isSidebarOpen, toggleSidebar } = useContext(SidebarContext);
  const { resolvedTheme } = useTheme();
  const allowedMenu = useFilteredMenus(navigationMenus);

  const getLogoSrc = () => {
    if (isSidebarOpen) {
      return resolvedTheme === "dark" ? "/Logo_White.svg" : "/Logo.svg";
    }
    return resolvedTheme === "dark" ? "/Icon_White.svg" : "/Icon.svg";
  };

  return (
    <div
      className={`hidden h-[calc(100vh)] flex-col border-r bg-background transition-all md:flex ${isSidebarOpen ? "min-w-60" : "w-14"}`}>
      <div className="flex h-[60px] shrink-0 items-center justify-between border-b bg-background px-3">
        <div
          className={cn(
            "relative inline-block cursor-auto overflow-hidden transition-all",
            isSidebarOpen ? "h-[36px] w-[72px]" : "h-8 w-8",
          )}>
          <Logo
            src={getLogoSrc()}
            alt="Logo"
            className="h-full w-full object-contain"
          />
        </div>
        {isSidebarOpen && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 p-0"
            onClick={toggleSidebar}>
            <PanelLeft className="h-6 w-6" />
          </Button>
        )}
      </div>
      <div className="flex-1 overflow-auto">
        <nav className={cn("grid w-full items-start gap-1 p-2 text-sm")}>
          {allowedMenu.map((menu) => (
            <Fragment key={menu.id}>
              {menu.type === "menu" ? (
                <DesktopMenuItem menu={menu} isSidebarOpen={isSidebarOpen} />
              ) : (
                <Separator />
              )}
            </Fragment>
          ))}
        </nav>
      </div>
    </div>
  );
}
