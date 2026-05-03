import { API_BASE } from "@/constants/endpoint.constant";

// ─── Captcha endpoints (captcha.service) ────────────────────────────────────

const CAPTCHA_SUBPATH = "/Captcha";

export const CAPTCHA_ENDPOINTS = {
  GETS: `${API_BASE}${CAPTCHA_SUBPATH}/Gets`,
  SAVE: `${API_BASE}${CAPTCHA_SUBPATH}/Save`,
  UPDATE_STATUS: `${API_BASE}${CAPTCHA_SUBPATH}/UpdateStatus`,
} as const;
