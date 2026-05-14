import { Menu } from "@/models/menu.model";
import { GitBranch } from "lucide-react";

export const navigationMenus: Menu[] = [
  {
    id: "deployment",
    type: "menu",
    name: "Deployment",
    path: "/deployment",
    icon: GitBranch,
  },
];
