import { API_BASE } from "@/constants/endpoint.constant";

// ─── Log endpoints ────────────────────────────────────────────────────────────

const LOG_SUBPATH = "/Log";

export const LOG_ENDPOINTS = {
  GET_LOGS: `${API_BASE}${LOG_SUBPATH}/GetLogs`,
  GET_LOGS_BY_DATE: `${API_BASE}${LOG_SUBPATH}/GetLogsByDate`,
  LIVE: `${API_BASE}${LOG_SUBPATH}/Live`,
} as const;

// ─── Trace endpoints ──────────────────────────────────────────────────────────

const TRACE_SUBPATH = "/Trace";

export const TRACE_ENDPOINTS = {
  GET_TRACES: `${API_BASE}${TRACE_SUBPATH}/GetTraces`,
  GET_TRACE: `${API_BASE}${TRACE_SUBPATH}/GetTrace`,
  GET_OPERATIONAL_ANALYTICS: `${API_BASE}${TRACE_SUBPATH}/GetOperationalAnalytics`,
  GET_SERVICE_ANALYTICS: `${API_BASE}${TRACE_SUBPATH}/GetServiceAnalytics`,
} as const;
