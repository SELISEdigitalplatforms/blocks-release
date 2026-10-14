// Frontend constants rather than BLOCKS_* runtime env: these are the same hosts in every environment,
// and the backend has no Dependency-Track UI host to hand back (only its API URL).
export const SONARQUBE_PORTAL_URL = "https://code.selise.biz";
export const DEPENDENCY_TRACK_PORTAL_URL = "https://sca.seliseblocks.com";

/* API Interface: AnalyticsTool/ProcessSonarQubeUser?buildId= */
export interface ISASTRedirectResponse {
  isSuccess?: boolean;
  data?: { projectKey?: string | null; branch?: string | null } | null;
}

/* API Interface: AnalyticsTool/ProcessDependencyTrackUser?buildId= */
export interface ISCARedirectResponse {
  isSuccess?: boolean;
  data?: { projectUuid?: string | null } | null;
}

/**
 * The build's project + branch dashboard in SonarQube. Without a project key it falls back to the
 * portal root. With no branch SonarQube shows the project's main branch.
 */
export const getSonarQubeDashboardUrl = (response: ISASTRedirectResponse | undefined): string => {
  const projectKey = response?.data?.projectKey?.trim();
  if (!projectKey) return SONARQUBE_PORTAL_URL;

  const params = new URLSearchParams({ id: projectKey });
  const branch = response?.data?.branch?.trim();
  if (branch) params.set("branch", branch);
  return `${SONARQUBE_PORTAL_URL}/dashboard?${params.toString()}`;
};

/**
 * The build's project in Dependency-Track, which keeps one project per repo + branch, addressed by
 * UUID. Without a UUID (no SCA analysis found yet) it falls back to the portal root.
 */
export const getDependencyTrackProjectUrl = (response: ISCARedirectResponse | undefined): string => {
  const projectUuid = response?.data?.projectUuid?.trim();
  if (!projectUuid) return DEPENDENCY_TRACK_PORTAL_URL;
  return `${DEPENDENCY_TRACK_PORTAL_URL}/projects/${encodeURIComponent(projectUuid)}`;
};

/**
 * Opens the tab synchronously inside the click, then points it at the URL once it resolves.
 * Calling window.open only after an await loses the user gesture, and browsers block it as a popup.
 */
export const openResolvedUrlInNewTab = async (resolveUrl: () => Promise<string>): Promise<void> => {
  const tab = window.open("about:blank", "_blank");
  if (tab) tab.opener = null;

  const url = await resolveUrl();
  if (tab) {
    tab.location.href = url;
  } else {
    window.open(url, "_blank", "noopener,noreferrer");
  }
};
