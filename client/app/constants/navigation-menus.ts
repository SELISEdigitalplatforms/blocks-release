import { Menu } from "@/models/menu-models";
import { GitBranch } from "lucide-react";

export const navigationMenus: Menu[] = [
  {
    id: "deployment",
    type: "menu",
    name: "Deployment",
    path: "/devops",
    icon: GitBranch,
  },
];
