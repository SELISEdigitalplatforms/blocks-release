import { API_BASE } from "@/constants/endpoint.constant";

// ─── MFA configuration endpoints (mfa.service — cloud config) ──────────────

const MFA_CONFIG_SUBPATH = "/MFA";

export const MFA_CONFIG_ENDPOINTS = {
  GET: `${API_BASE}${MFA_CONFIG_SUBPATH}/Get`,
  SAVE: `${API_BASE}${MFA_CONFIG_SUBPATH}/Save`,
} as const;

// ─── MFA endpoints (mfa.service — IDP & MFA bases) ─────────────────────────

const MFA_SUBPATH = "/Mfa";
const MANAGEMENT_SUBPATH = "/Management";

export const MFA_ENDPOINTS = {
  GENERATE_OTP: `${API_BASE}${MFA_SUBPATH}/GenerateOTP`,
  CONFIGURE_USER_MFA: `${API_BASE}${MANAGEMENT_SUBPATH}/ConfigureUserMfa`,
  SETUP_TOTP: `${API_BASE}${MFA_SUBPATH}/SetUpTotp`,
  VERIFY_OTP: `${API_BASE}${MFA_SUBPATH}/VerifyOTP`,
  RESEND_OTP: `${API_BASE}${MFA_SUBPATH}/ResendOtp`,
  DISABLE_MFA: `${API_BASE}${MFA_SUBPATH}/DisableUserMfa`,
} as const;
