// DEADCODE 2026-07-29: unreachable from main.tsx/router tree; whole file commented pending review
// import { BackToConsoleNavigator } from "@/components/back-to-console-navigator";
// import { Button } from "@/components/ui-kits/button/button";
// import { Notification } from "@blocks-communication/components/notification/notification";
// import { SidebarContext } from "@/contexts/dashboard-layout-provider";
// import { SidebarMobileView } from "@/layouts/sidebar-mobile-view/sidebar-mobile-view";
// import { cn } from "@/lib/utils";
// import { useProjectStore } from "@/store/project.store.ts";
// import { AppSwitcher, ThemeSwitcher, UserDropdownMenu } from "@seliseblocks/genesis-os";
// import { ChevronRight, FolderOpen, PanelLeft } from "lucide-react";
// import { useContext } from "react";
// import { useLocation } from "react-router";
//
//
// export function DashboardHeader() {
//   const { isSidebarOpen, toggleSidebar } = useContext(SidebarContext);
//   const { pathname } = useLocation();
//   const { selectedProject } = useProjectStore();
//   const projectName = selectedProject?.name;
//   const environment = selectedProject?.environment;
//   const isProjectOverviewRoute = pathname.startsWith("/app/project-overview");
//   return (
//     <>
//       <header className="flex h-[60px] items-center justify-between gap-4 border-b bg-background px-5 sm:px-6">
//         <div className="flex min-w-0 items-center gap-3">
//           <div className="md:hidden">
//             <SidebarMobileView />
//           </div>
//           <Button
//             variant="ghost"
//             size="icon"
//             className={cn("hidden shrink-0 p-0", !isSidebarOpen && "md:inline-flex")}
//             onClick={toggleSidebar}
//           >
//             <PanelLeft className="h-6 w-6" />
//           </Button>
//           {!isProjectOverviewRoute && !isSidebarOpen && (projectName || environment) && (
//             <div className="hidden min-w-0 items-center gap-1.5 md:flex">
//               <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
//               {projectName && (
//                 <span className="truncate text-sm font-medium text-foreground">{projectName}</span>
//               )}
//               {projectName && environment && (
//                 <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
//               )}
//               {environment && (
//                 <span className="rounded-sm bg-[hsl(var(--blocks-primary-50))] px-1.5 py-0.5 text-[11px] font-semibold text-[hsl(var(--high-emphasis))]">
//                   {environment}
//                 </span>
//               )}
//             </div>
//           )}
//         </div>
//         <div className="flex items-center gap-4">
//           <BackToConsoleNavigator />
//           <ThemeSwitcher />
//           <Notification />
//           <AppSwitcher forwardedTo="/app/dashboard" />
//           <UserDropdownMenu />
//         </div>
//       </header>
//     </>
//   );
// }
