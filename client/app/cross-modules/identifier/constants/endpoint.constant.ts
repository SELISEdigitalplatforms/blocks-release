import { API_BASE } from "@/constants/endpoint.constant";

// ─── Project endpoints ────────────────────────────────────────────────────────

const PROJECT_SUBPATH = "/Project";

export const PROJECT_ENDPOINTS = {
  GETS: `${API_BASE}${PROJECT_SUBPATH}/Gets`,
  GET: `${API_BASE}${PROJECT_SUBPATH}/Get`,
  ADD_ASSET: `${API_BASE}${PROJECT_SUBPATH}/AddAsset`,
} as const;

// ─── Cloud Build endpoints ────────────────────────────────────────────────────

const BUILD_SUBPATH = "/build";

export const CLOUD_BUILD_ENDPOINTS = {
  REPOS_LIST: `${API_BASE}${BUILD_SUBPATH}/repos-list`,
} as const;
