import { Outlet } from "react-router";

export function DeploymentLayout() {
  return (
    <main className="px-6 pb-6 pt-4">
      <Outlet />
    </main>
  );
}
