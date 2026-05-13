import { API_BASE } from "@/constants/endpoint.constant";

// ─── Subpaths ─────────────────────────────────────────────────────────────────

const IAM_SUBPATH = "/Iam";

// ─── Account endpoints (account.service) ────────────────────────────────────

export const ACCOUNT_ENDPOINTS = {
  RECOVER: `${API_BASE}${IAM_SUBPATH}/Recover`,
} as const;

// ─── User endpoints (user.service) ──────────────────────────────────────────

export const USER_ENDPOINTS = {
  GET_USER: `${API_BASE}${IAM_SUBPATH}/user`,
} as const;
