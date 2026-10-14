import { Navigate, Outlet, type RouteObject } from "react-router";
import {
  AuthResolver,
  PublicGuard,
  ProtectedGuard,
  LoginPage,
  CallbackPage,
  ImpersonationChecker,
  ImpersonationTerminator,
  ConsolePage,
  DashboardOverview,
} from "@seliseblocks/app-kit";
import { ProfilePage } from "@seliseblocks/app-kit";
import DeploymentPage from "./deployment/deployment";
import DeploymentRepoDetailsPage from "./deployment/deployment-repo-details";
import DeploymentLogsPage from "./deployment/deployment-logs";
import DeploymentLivePage from "./deployment/deployment-live";
import { DeploymentLayout } from "@/layouts/deployment-layout";
import { AppShell } from "@/layouts/app-shell";
import { ReleaseDashboardRoute } from "@/layouts/release-dashboard-route";

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
              {
                path: "callback",
                element: <CallbackPage defaultRedirectUrl="/app/console" />,
              },
            ],
          },
        ],
      },

      // ── Protected routes ── (all live under the /app prefix)
      {
        path: "/app",
        element: (
          <ProtectedGuard>
            <Outlet />
          </ProtectedGuard>
        ),
        children: [
          // Bare /app → console.
          { index: true, element: <Navigate to="/app/console" replace /> },

          // Returning to the console terminates the environment session before rendering.
          {
            element: (
              <ImpersonationChecker>
                <ImpersonationTerminator>
                  <AppShell>
                    <Outlet />
                  </AppShell>
                </ImpersonationTerminator>
              </ImpersonationChecker>
            ),
            children: [
              { path: "console", element: <ConsolePage /> },
              { path: "profile", element: <ProfilePage /> },
            ],
          },
          // Impersonated project scope: /app/:itemId/*
          {
            path: ":itemId",
            element: <ReleaseDashboardRoute />,
            children: [
              {
                index: true,
                element: <Navigate to="dashboard" replace />,
              },
              {
                path: "dashboard",
                element: <DashboardOverview />,
              },
              {
                element: <DeploymentLayout />,
                children: [
                  {
                    index: true,
                    element: <Navigate to="deployment" replace />,
                  },
                  {
                    path: "deployment",
                    element: <DeploymentPage />,
                  },
                  {
                    path: "deployment/repo/:repoId",
                    element: <DeploymentRepoDetailsPage />,
                  },
                  {
                    path: "deployment/repo/:repoId/deployment-logs/:buildId",
                    element: <DeploymentLogsPage />,
                  },
                  {
                    path: "deployment/repo/:repoId/deployment-live/:buildId",
                    element: <DeploymentLivePage />,
                  },
                ],
              },
            ],
          },
        ],
      },

      { path: "/", element: <Navigate to="/app/console" replace /> },
      // ── Catch-all: redirect to login ──
      { path: "*", element: <Navigate to="/login" replace /> },
    ],
  },
] as const satisfies RouteObject[];
