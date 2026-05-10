import { createBrowserRouter, Navigate } from "react-router-dom";

// Layouts
import { OidcLayout } from "./layouts/oidc-layout";
import { DashboardLayout } from "./layouts/dashboard-layout";

// Auth routes
import LoginSimplePage from "./routes/auth/login-simple";

// OIDC routes (un-guarded)
import OidcIndexPage from "./routes/oidc/index";
import OidcLoginPage from "./routes/oidc/login";
import OidcPermissionPage from "./routes/oidc/permission";
import OidcErrorPage from "./routes/oidc/error";
import OidcForgotPasswordPage from "./routes/oidc/forgot-password";
import OidcEmailSentConfirmationPage from "./routes/oidc/email-sent-confirmation";

// Deployment routes (module devops)
import DeploymentPage from "./routes/deployment/deployment";
import DeploymentRepoDetailsPage from "./routes/deployment/deployment-repo-details";
import DeploymentLogsPage from "./routes/deployment/deployment-logs";
import DeploymentLivePage from "./routes/deployment/deployment-live";
import ProfilePage from "./routes/dashboard/profile";

export const router = createBrowserRouter([

    // ── Simple login (no guards, no API calls) ──
    { path: "/login", element: <LoginSimplePage /> },


    // ── OIDC layout (un-guarded, themed) ──
    {
        path: "/oidc",
        element: <OidcLayout />,
        children: [
            { index: true, element: <OidcIndexPage /> },
            { path: "login", element: <OidcLoginPage /> },
            { path: "permission", element: <OidcPermissionPage /> },
            { path: "error", element: <OidcErrorPage /> },
            { path: "forgot-password", element: <OidcForgotPasswordPage /> },
            { path: "email-sent-confirmation", element: <OidcEmailSentConfirmationPage /> },
        ],
    },

    // ── Dashboard and project overview in dashboard layout (consolidated sidebar) ──
    {
        element: <DashboardLayout />,
        children: [
            { path: "/profile", element: <ProfilePage /> },
            { path: "/devops", element: <DeploymentPage /> },
            { path: "/devops/repo/:repoId", element: <DeploymentRepoDetailsPage /> },
            { path: "/devops/repo/:repoId/deployment-logs/:buildId", element: <DeploymentLogsPage /> },
            { path: "/devops/repo/:repoId/deployment-live/:buildId", element: <DeploymentLivePage /> },
        ],
    },

    // ── Root redirect: authenticated users go to devops ──
    { path: "/", element: <Navigate to="/devops" replace /> },

    // ── Catch-all: redirect to login ──
    { path: "*", element: <Navigate to="/login" replace /> },
]);
