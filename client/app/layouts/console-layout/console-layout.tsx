// DEADCODE 2026-07-29: unreachable from main.tsx/router tree; whole file commented pending review
// import { Outlet, Link } from "react-router";
// import { Logo } from "@/components/logo";
// import { ModeToggle } from "@/components/mode-toggle/mode-toggle";
// import { Notification } from "@blocks-communication/components/notification/notification";
// import { BlocksAppLauncher } from "@/components/blocks-app-launcher/blocks-app-launcher";
// import { UserDropdownMenu } from "@/components/user-dropdown-menu/user-dropdown-menu";
//
// // Auth/impersonation guards are applied by the router (blocks-kit
// // AuthResolver/ProtectedGuard/ImpersonationChecker/ImpersonationTerminator);
// // this layout is purely the console chrome.
// export function ConsoleLayout() {
//   return (
//     <div className="relative min-h-screen bg-[hsl(var(--surface-app))]">
//       <div className="fixed left-0 right-0 top-0 z-40 border-b bg-background">
//         <header className="mx-5 flex h-12 items-center justify-between gap-4 sm:mx-10 lg:h-[59px]">
//           <Link to="/app/console" className="cursor-pointer">
//             <Logo width={96} height={32} className="h-8 w-auto" />
//           </Link>
//           <div className="flex items-center gap-4">
//             <ModeToggle />
//             <Notification />
//             <BlocksAppLauncher />
//             <UserDropdownMenu />
//           </div>
//         </header>
//       </div>
//       <main className="pt-[59px]">
//         <Outlet />
//       </main>
//     </div>
//   );
// }
