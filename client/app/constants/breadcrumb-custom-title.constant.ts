import type { RouterType } from "@/router";

export const BREADCRUMB_CUSTOM_TITLES: Record<RouterType, string | null> = {
  "/": null,
  "/app": null,
  "/app/console": null,
  "/app/profile": null,
  "/app/:itemId": null,
  "/app/:itemId/dashboard": null,
  "/app/:itemId/deployment": null,
  "/app/:itemId/deployment/repo/:repoId": null,
  "/app/:itemId/deployment/repo/:repoId/deployment-logs/:buildId": null,
  "/app/:itemId/deployment/repo/:repoId/deployment-live/:buildId": null,
  "/login": null,
  "/login/callback": null,
  "/*": null,
};
