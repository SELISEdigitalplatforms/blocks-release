import { Navigate, Outlet, type RouteObject } from "react-router";
import {
  AuthResolver,
  PublicGuard,
  ProtectedGuard,
  LoginPage,
  CallbackPage,
  ConsoleLayout,
  ConsolePage,
  DashboardRoute,
  DashboardOverview,
  // ProjectOverviewRoute / DashboardRoute are URL-addressable route elements:
  // they hydrate the selected project from the URL param (:tenantGroupId / :itemId),
  // validate it (redirecting to /app/console when invalid), inject the id into the
  // navigation-menu paths, and render ProjectOverviewLayout / DashboardLayout
  // (which self-wrap the impersonation guards) with an <Outlet /> for children.
} from "@seliseblocks/genesis-os";
import { ProfilePage } from "@seliseblocks/genesis-os";
import DeploymentPage from "./deployment/deployment";
import DeploymentRepoDetailsPage from "./deployment/deployment-repo-details";
import DeploymentLogsPage from "./deployment/deployment-logs";
import DeploymentLivePage from "./deployment/deployment-live";
import { navigationMenus } from "@/constants/navigation-menus.constant";
import { DeploymentLayout } from "@/layouts/deployment-layout";

const redirectPaths: Record<string, string> = {
  "/app/release/monitor/*": "/app/release",
  "/app/release/monitor/incidents/*": "/app/release",
};

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

          // Console: ConsoleLayout self-wraps ImpersonationChecker + ImpersonationTerminator.
          {
            element: (
              <ConsoleLayout>
                <Outlet />
              </ConsoleLayout>
            ),
            children: [
              { path: "console", element: <ConsolePage /> },
              { path: "profile", element: <ProfilePage /> },
            ],
          },
          // Impersonated project scope: /app/:itemId/*
          {
            path: ":itemId",
            element: (
              <DashboardRoute
                redirectPaths={redirectPaths}
                navigationMenus={navigationMenus}
              />
            ),
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
