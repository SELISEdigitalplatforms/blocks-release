import { API_BASE } from "@/constants/endpoint.constant";
import { getRuntimeEnv } from "@/lib/runtime-env";

const rawAlertBase = getRuntimeEnv("BLOCKS_OBSERVABILITY_APP_URL");
const alertBase = rawAlertBase.replace(/\/+$/, "");
const apiBase = API_BASE.replace(/^\/+/, "");

let didWarnMissingAlertBase = false;

const buildAlertEndpoint = (path: string): string => {
  const cleanedPath = path.replace(/^\/+/, "");
  if (!alertBase) {
    if (!didWarnMissingAlertBase) {
      console.warn(
        "BLOCKS_OBSERVABILITY_APP_URL is missing; alert endpoints will use the current origin.",
      );
      didWarnMissingAlertBase = true;
    }
    return `/${apiBase}/${cleanedPath}`;
  }

  return `${alertBase}/${apiBase}/${cleanedPath}`;
};

export const ALERT_ENDPOINTS = {
  SAVE_MONITOR: buildAlertEndpoint("Monitor/SaveMonitor"),
  UPDATE_MONITOR: buildAlertEndpoint("Monitor/UpdateMonitor"),
  DELETE_MONITOR: buildAlertEndpoint("Monitor/DeleteMonitor"),
  GET_MONITOR_LIST: buildAlertEndpoint("Monitor/GetMonitorList"),
  GET_MONITOR_LIST_BY_REPO_ID: buildAlertEndpoint("Monitor/GetMonitorListByRepoId"),
  GET_MONITOR_DETAILS: buildAlertEndpoint("Monitor/GetMonitorDetails"),
  IS_EXTERNAL_SERVICE_CONFIGURED: buildAlertEndpoint("Monitor/IsExternalServiceConfigured"),
  GET_INCIDENT_LIST: buildAlertEndpoint("Monitor/GetIncidentList"),
  GET_MONITOR_BY_ID: buildAlertEndpoint("Monitor/GetMonitorById"),
  GET_MONITOR_RESPONSE_TIME: buildAlertEndpoint("Monitor/GetMonitorResponseTime"),
  GET_MONITOR_DOWN_TIME: buildAlertEndpoint("Monitor/GetMonitorDownTime"),
  SAVE_HEALTH: buildAlertEndpoint("Health/SaveHealth"),
  UPDATE_HEALTH: buildAlertEndpoint("Health/UpdateHealth"),
  DELETE_HEALTH: buildAlertEndpoint("Health/DeleteHealth"),
} as const;

export const CLOUD_BUILD_ENDPOINTS = {
  ACCESS_TOKEN: `${API_BASE}/auth/AccessToken`,
  IS_AUTHORIZED: `${API_BASE}/auth/isAuthorized`,
  REMOVE_AUTHORIZATION: `${API_BASE}/auth/RemoveAuthorization`,
  REMOVE_ACCESS_TOKEN: `${API_BASE}/auth/removeAccessToken`,
  GITHUB_REPOS: `${API_BASE}/github/repos`,
  GITHUB_USER: `${API_BASE}/github/user`,
  GITHUB_BRANCHES: `${API_BASE}/github/branches`,
  GITHUB_BRANCH_EXISTS: `${API_BASE}/github/GithubBranchExists`,
  BUILD: `${API_BASE}/build`,
  BUILD_BUILD: `${API_BASE}/build/build`,
  REPOS: `${API_BASE}/build/repos`,
  REPOS_LIST: `${API_BASE}/build/repos-list`,
  REPO_DETAILS: `${API_BASE}/build/repo-details`,
  RUN_BUILD: `${API_BASE}/build/run-build`,
  MANUAL: `${API_BASE}/build/manual`,
  SETTINGS: `${API_BASE}/build/settings`,
  REPORTS: `${API_BASE}/build/reports`,
  PROCESS_DEPENDENCY_TRACK_USER: `${API_BASE}/AnalyticsTool/ProcessDependencyTrackUser`,
  PROCESS_SONARQUBE_USER: `${API_BASE}/AnalyticsTool/ProcessSonarQubeUser`,
} as const;
