import { Outlet, Link } from "react-router-dom";
import {
  ImpersonationChecker,
  ImpersonationTerminator,
  ProtectedGuard,
} from "@/guards/protected-guard";
import { Logo } from "@/components/logo";
import { ModeToggle } from "@/components/mode-toggle/mode-toggle";
import { Notification } from "@/components/notification/notification";
import { BlocksAppLauncher } from "@/components/blocks-app-launcher/blocks-app-launcher";
import { UserDropdownMenu } from "@/components/user-dropdown-menu/user-dropdown-menu";

export function ConsoleLayout() {
  return (
    <ProtectedGuard>
      <ImpersonationChecker>
        <ImpersonationTerminator>
          <div className="relative min-h-screen bg-[hsl(var(--surface-app))]">
            <div className="fixed left-0 right-0 top-0 z-40 border-b bg-background">
              <header className="mx-5 flex h-12 items-center justify-between gap-4 sm:mx-10 lg:h-[59px]">
                <Link to="/console" className="cursor-pointer">
                  <Logo width={96} height={32} className="h-8 w-auto" />
                </Link>
                <div className="flex items-center gap-4">
                  <ModeToggle />
                  <Notification />
                  <BlocksAppLauncher />
                  <UserDropdownMenu />
                </div>
              </header>
            </div>
            <main className="pt-[59px]">
              <Outlet />
            </main>
          </div>
        </ImpersonationTerminator>
      </ImpersonationChecker>
    </ProtectedGuard>
  );
}
