import { API_BASE } from "@/constants/endpoint.constant";

const AUTH_SUBPATH = "/Authentication";

export const AUTH_ENDPOINTS = {
  TOKEN: `${API_BASE}${AUTH_SUBPATH}/Token`,
  GET_SOCIAL_LOGIN_ENDPOINT: `${API_BASE}${AUTH_SUBPATH}/GetSocialLogInEndPoint`,
  GET_LOGIN_OPTIONS: `${API_BASE}${AUTH_SUBPATH}/GetLoginOptions`,
  LOGOUT: `${API_BASE}/auth/Logout`,
} as const;

export const AUTH_OIDC_ENDPOINTS = {
  GET_OIDC_CLIENTS: `${API_BASE}${AUTH_SUBPATH}/GetOIDCClients`,
  GET_OIDC_CLIENT: `${API_BASE}${AUTH_SUBPATH}/GetOIDCClient`,
  SAVE_OIDC_CLIENT: `${API_BASE}${AUTH_SUBPATH}/SaveOIDCClient`,
  DELETE_OIDC_CLIENT: `${API_BASE}${AUTH_SUBPATH}/DeleteOIDCClient`,
} as const;

export const OIDC_FLOW_ENDPOINTS = {
  USER_ACKNOWLEDGEMENT: `${API_BASE}${AUTH_SUBPATH}/UserAcknowledgement`,
} as const;

export const IMPERSONATION_ENDPOINTS = {
  IMPERSONATE: `${API_BASE}${AUTH_SUBPATH}/impersonate`,
  STOP_IMPERSONATION: `${API_BASE}${AUTH_SUBPATH}/impersonation/stop`,
} as const;
