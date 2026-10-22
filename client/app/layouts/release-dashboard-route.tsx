import { Navigate, Outlet, useParams } from "react-router";
import { ImpersonationChecker, ImpersonationSynchronizer } from "@seliseblocks/app-kit";
import { AppShell } from "./app-shell";

/** Console's current shell, with app-kit's URL/tenant impersonation guards. */
export function ReleaseDashboardRoute() {
  const { itemId } = useParams();
  if (!itemId) return <Navigate to="/app/console" replace />;
  return (
    <ImpersonationChecker>
      <ImpersonationSynchronizer>
        <AppShell sidebar>
          <Outlet />
        </AppShell>
      </ImpersonationSynchronizer>
    </ImpersonationChecker>
  );
}
