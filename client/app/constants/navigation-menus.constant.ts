import { Menu } from "@/models/menu.model";
import { GitBranch, Home } from "lucide-react";

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
];
