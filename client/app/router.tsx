import { createBrowserRouter, Navigate } from "react-router-dom";

// Layouts
import { DashboardLayout } from "./layouts/dashboard-layout/dashboard-layout";
import { OidcLayout } from "./layouts/oidc-layout/oidc-layout";

// Auth routes
import LoginPage from "./routes/auth/login";

// OIDC routes (un-guarded)
import OidcIndexPage from "./routes/oidc/index";

// Deployment routes (module deployment)
import ProfilePage from "./routes/dashboard/profile";
import DeploymentPage from "./routes/deployment/deployment";
import DeploymentLivePage from "./routes/deployment/deployment-live";
import DeploymentLogsPage from "./routes/deployment/deployment-logs";
import DeploymentRepoDetailsPage from "./routes/deployment/deployment-repo-details";

export const router = createBrowserRouter([
  // ── Simple login (no guards, no API calls) ──
  { path: "/login", element: <LoginPage /> },

  // ── OIDC layout (un-guarded, themed) ──
  {
    path: "/oidc",
    element: <OidcLayout />,
    children: [{ index: true, element: <OidcIndexPage /> }],
  },

  // ── Dashboard and project overview in dashboard layout (consolidated sidebar) ──
  {
    element: <DashboardLayout />,
    children: [
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

  // ── Root redirect: authenticated users go to deployment ──
  { path: "/", element: <Navigate to="/deployment" replace /> },

  // ── Catch-all: redirect to login ──
  { path: "*", element: <Navigate to="/login" replace /> },
]);
