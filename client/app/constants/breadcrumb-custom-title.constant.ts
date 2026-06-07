import type { RouterType } from "@/router";

export const BREADCRUMB_CUSTOM_TITLES: Record<RouterType, string | null> = {
  "/": null,
  "/console": null,
  "/dashboard": null,
  "/project-overview": null,
  "/project-overview/environments": null,
  "/deployment": null,
  "/deployment/repo/:repoId": null,
  "/deployment/repo/:repoId/deployment-logs/:buildId": null,
  "/deployment/repo/:repoId/deployment-live/:buildId": null,
  "/login": null,
  "/login/callback": null,
  "/profile": null,
  "/*": null,
};
