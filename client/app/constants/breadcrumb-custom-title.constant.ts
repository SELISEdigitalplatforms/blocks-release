import type { RouterType } from "@/router";

export const BREADCRUMB_CUSTOM_TITLES: Record<RouterType, string | null> = {
  "/": null,
  "/app": null,
  "/app/console": null,
  "/app/dashboard": null,
  "/app/project-overview": null,
  "/app/project-overview/environments": null,
  "/app/deployment": null,
  "/app/deployment/repo/:repoId": null,
  "/app/deployment/repo/:repoId/deployment-logs/:buildId": null,
  "/app/deployment/repo/:repoId/deployment-live/:buildId": null,
  "/login": null,
  "/login/callback": null,
  "/app/profile": null,
  "/*": null,
};
