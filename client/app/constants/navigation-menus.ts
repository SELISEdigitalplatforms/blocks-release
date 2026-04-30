import { Menu } from "@/models/menu-models";
import { Home, Package, Users, BookMinus, Settings, Shield, Key, ShieldCheck, ScanFace, Lock, Zap, Gauge, GitBranch } from "lucide-react";

export const navigationMenus: Menu[] = [
  {
    id: "deployment",
    type: "menu",
    name: "Deployment",
    path: "/devops",
    icon: GitBranch,
  },
  {
    type: "separator",
    id: "separator-deployment",
  },
  // Hidden menus below - kept for backward compatibility but disabled
  {
    id: "overview-project",
    type: "menu",
    name: "Overview",
    path: "/dashboard",
    icon: Home,
    disabled: true,
  },
  {
    id: "environments",
    type: "menu",
    name: "Environments",
    path: "/project-overview/environments",
    icon: Package,
    disabled: true,
  },
  {
    id: "people",
    type: "menu",
    name: "People",
    path: "/project-overview/people",
    icon: Users,
    disabled: true,
  },
  {
    id: "repositories",
    type: "menu",
    name: "Repositories",
    path: "/project-overview/repositories",
    icon: BookMinus,
    disabled: true,
  },
  {
    id: "settings",
    type: "menu",
    name: "Project Settings",
    path: "/project-overview/settings",
    icon: Settings,
    disabled: true,
  },
  {
    id: "service-identity__authentication",
    type: "menu",
    name: "IDP",
    path: "/services/authentication",
    icon: Key,
    disabled: true,
  },
  {
    id: "service-identity__api-settings",
    type: "menu",
    name: "API Settings",
    path: "/services/api-settings",
    icon: Settings,
    disabled: true,
  },
  {
    id: "service-identity__secret-management",
    type: "menu",
    name: "Secrets & Configs",
    path: "/services/secret-management",
    icon: Lock,
    disabled: true,
  },
  {
    id: "service-identity__lmt",
    type: "menu",
    name: "LMT",
    path: "/services/lmt",
    icon: Zap,
    disabled: true,
  },
];
