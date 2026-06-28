import { Menu } from "@/models/menu.model";
import { GitBranch, Home, Package } from "lucide-react";

export const navigationMenus: Menu[] = [
  {
    id: "overview-project",
    type: "menu",
    name: "Overview",
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
    name: "Deployment",
    path: "/app/deployment",
    icon: GitBranch,
  },
  // Project-overview-scoped menu (shown only on /project-overview routes).
  {
    id: "environments",
    type: "menu",
    name: "Environments",
    path: "/app/project-overview/environments",
    icon: Package,
  },
];
