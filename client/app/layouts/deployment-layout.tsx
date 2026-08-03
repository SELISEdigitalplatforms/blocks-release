import { Outlet } from "react-router";

export function DeploymentLayout() {
  return (
    <main className="p-2 md:p-6">
      <Outlet />
    </main>
  );
}
