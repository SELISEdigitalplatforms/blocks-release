import { API_BASE } from "@/constants/endpoint.constant";

export const ALERT_ENDPOINTS = {
  UPDATE_MONITOR: `${API_BASE}/Monitor/UpdateMonitor`,
  DELETE_MONITOR: `${API_BASE}/Monitor/DeleteMonitor`,
  GET_MONITOR_LIST_BY_REPO_ID: `${API_BASE}/Monitor/GetMonitorListByRepoId`,
  UPDATE_HEALTH: `${API_BASE}/Health/UpdateHealth`,
  DELETE_HEALTH: `${API_BASE}/Health/DeleteHealth`,
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
