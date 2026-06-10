import { Navigate, Outlet, type RouteObject } from "react-router-dom";
import {
  AuthResolver,
  PublicGuard,
  ProtectedGuard,
  ImpersonationChecker,
  ImpersonationTerminator,
  ImpersonationSynchronizer,
  LoginPage,
  CallbackPage,
  ConsoleLayout,
  ConsolePage,
  // blocks-kit DashboardLayout is a generic shell (expects sidebar/header/children
  // props), so the deployment dashboard uses the local DashboardLayout below.
  // DashboardLayout
} from "@seliseblocks/blocks-kit";
import { DashboardLayout } from "@/layouts/dashboard-layout/dashboard-layout";
import { ProjectOverviewLayout } from "@/layouts/project-overview-layout";
// import { ConsoleLayout } from "@/layouts/console-layout/console-layout";
// import { Console } from "@/pages/console/console";
// import LoginPage from "./auth/login";
// import CallbackPage from "./callback";
import { EnvironmentsPage } from "@/pages/environments/environments";
import { DashboardOverview } from "@/pages/dashboard/dashboard-overview";
import { ProfilePage } from "@seliseblocks/blocks-kit";
import DeploymentPage from "./deployment/deployment";
import DeploymentRepoDetailsPage from "./deployment/deployment-repo-details";
import DeploymentLogsPage from "./deployment/deployment-logs";
import DeploymentLivePage from "./deployment/deployment-live";

export const routes = [
  {
    // Resolve authentication state before rendering any route.
    element: (
      <AuthResolver>
        <Outlet />
      </AuthResolver>
    ),
    children: [
      // ── Public routes ──
      {
        element: (
          <PublicGuard>
            <Outlet />
          </PublicGuard>
        ),
        children: [
          {
            path: "/login",
            children: [
              { index: true, element: <LoginPage /> },
              { path: "callback", element: <CallbackPage redirectUrl="/console" /> },
            ],
          },
        ],
      },

      // ── Protected routes ──
      {
        element: (
          <ProtectedGuard>
            <Outlet />
          </ProtectedGuard>
        ),
        children: [
          // Console: terminate any active impersonation before rendering.
          {
            element: (
              <ImpersonationChecker>
                <ImpersonationTerminator>
                  <Outlet />
                </ImpersonationTerminator>
              </ImpersonationChecker>
            ),
            children: [
              {
                element: (
                  <ConsoleLayout>
                    <Outlet />
                  </ConsoleLayout>
                ),
                children: [
                  { path: "/console", element: <ConsolePage /> },
                  { path: "/profile", element: <ProfilePage /> },
                ],
              },
            ],
          },
          // Deployment: synchronize impersonation with the selected project.
          {
            element: (
              <ImpersonationChecker>
                <ImpersonationSynchronizer>
                  <Outlet />
                </ImpersonationSynchronizer>
              </ImpersonationChecker>
            ),
            children: [
              {
                element: <DashboardLayout />,
                children: [
                  { path: "/dashboard", element: <DashboardOverview /> },
                  { path: "/deployment", element: <DeploymentPage /> },
                  {
                    path: "/deployment/repo/:repoId",
                    element: <DeploymentRepoDetailsPage />,
                  },
                  {
                    path: "/deployment/repo/:repoId/deployment-logs/:buildId",
                    element: <DeploymentLogsPage />,
                  },
                  {
                    path: "/deployment/repo/:repoId/deployment-live/:buildId",
                    element: <DeploymentLivePage />,
                  },
                  { path: "/profile", element: <ProfilePage /> },
                ],
              },
            ],
          },
          // Project overview: environments listing for the selected project group.
          {
            path: "/project-overview",
            element: <ProjectOverviewLayout />,
            children: [
              { path: "environments", element: <EnvironmentsPage /> },
            ],
          },
        ],
      },

      { path: "/", element: <Navigate to="/console" replace /> },
      // ── Catch-all: redirect to login ──
      { path: "*", element: <Navigate to="/login" replace /> },
    ],
  },
] as const satisfies RouteObject[];
