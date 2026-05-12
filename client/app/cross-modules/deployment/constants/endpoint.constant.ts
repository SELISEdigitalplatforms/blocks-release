import { API_BASE } from "@/constants/endpoint.constant";

export const ALERT_ENDPOINTS = {
  SAVE_MONITOR:
    "https://dev-logic.blocksdevelopers.com/api/Monitor/SaveMonitor",
  UPDATE_MONITOR:
    "https://dev-logic.blocksdevelopers.com/api/Monitor/UpdateMonitor",
  DELETE_MONITOR:
    "https://dev-logic.blocksdevelopers.com/api/Monitor/DeleteMonitor",
  GET_MONITOR_LIST:
    "https://dev-logic.blocksdevelopers.com/api/Monitor/GetMonitorList",
  GET_MONITOR_LIST_BY_REPO_ID:
    "https://dev-logic.blocksdevelopers.com/api/Monitor/GetMonitorListByRepoId",
  GET_MONITOR_DETAILS:
    "https://dev-logic.blocksdevelopers.com/api/Monitor/GetMonitorDetails",
  IS_EXTERNAL_SERVICE_CONFIGURED:
    "https://dev-logic.blocksdevelopers.com/api/Monitor/IsExternalServiceConfigured",
  GET_INCIDENT_LIST:
    "https://dev-logic.blocksdevelopers.com/api/Monitor/GetIncidentList",
  GET_MONITOR_BY_ID:
    "https://dev-logic.blocksdevelopers.com/api/Monitor/GetMonitorById",
  GET_MONITOR_RESPONSE_TIME:
    "https://dev-logic.blocksdevelopers.com/api/Monitor/GetMonitorResponseTime",
  GET_MONITOR_DOWN_TIME:
    "https://dev-logic.blocksdevelopers.com/api/Monitor/GetMonitorDownTime",
  SAVE_HEALTH: "https://dev-logic.blocksdevelopers.com/api/Health/SaveHealth",
  UPDATE_HEALTH:
    "https://dev-logic.blocksdevelopers.com/api/Health/UpdateHealth",
  DELETE_HEALTH:
    "https://dev-logic.blocksdevelopers.com/api/Health/DeleteHealth",
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
