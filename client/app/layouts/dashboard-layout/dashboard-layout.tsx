// DEADCODE 2026-07-29: unreachable from main.tsx/router tree; whole file commented pending review
// import { ErrorBoundary } from "@/components/error-boundary";
// import { DashboardLayoutProvider } from "@/contexts/dashboard-layout-provider";
// import { DashboardHeader } from "@/layouts/dashboard-header/dashboard-header";
// import { SidebarMenuDesktop } from "@/layouts/sidebar-menu-desktop/sidebar-menu-desktop";
// import { Outlet } from "react-router";
//
// // Auth/impersonation guards are applied by the router (blocks-kit
// // AuthResolver/ProtectedGuard/ImpersonationChecker/ImpersonationSynchronizer);
// // this layout is purely the dashboard chrome.
// export function DashboardLayout() {
//   return (
//     <DashboardLayoutProvider isOpen={true} persist>
//       <div className="relative flex h-screen overflow-hidden bg-[hsl(var(--surface-app))]">
//         <SidebarMenuDesktop />
//         <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
//           <DashboardHeader />
//           <main className="flex-1 overflow-y-auto overflow-x-hidden">
//             <ErrorBoundary>
//               <Outlet />
//             </ErrorBoundary>
//           </main>
//         </div>
//       </div>
//     </DashboardLayoutProvider>
//   );
// }
