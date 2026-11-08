import { Menu } from "@/models/menu.model";
import { GitBranch, Home, Package } from "lucide-react";
import { tStatic } from "@seliseblocks/genesis-os";

const MODULE = "release.shared";

// Names are looked up when the menus are read, so a language change is picked up.
export const getNavigationMenus = (): Menu[] => [
  {
    id: "overview-project",
    type: "menu",
    name: tStatic(MODULE, "NAVIGATION_MENUS.OVERVIEW"),
    path: "/app/dashboard",
    icon: Home,
  },
  {
    type: "separator",
    id: "separator-overview",
  },
  {
    id: "deployment",
    type: "menu",
    name: tStatic(MODULE, "NAVIGATION_MENUS.DEPLOYMENT"),
    path: "/app/deployment",
    icon: GitBranch,
  },
  // Project-overview-scoped menu (shown only on /app/project routes).
  // Kept id-less: ProjectOverviewRoute injects the :tenantGroupId at render time.
  {
    id: "environments",
    type: "menu",
    name: tStatic(MODULE, "NAVIGATION_MENUS.ENVIRONMENTS"),
    path: "/app/project/environments",
    icon: Package,
  },
];
