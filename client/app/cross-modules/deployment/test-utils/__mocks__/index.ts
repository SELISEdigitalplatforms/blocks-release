import { vi } from "vitest";

/**
 * Shared fixtures and mock factories for the deployment module's unit tests.
 *
 * The service tests exercise the real service against a mocked `@/lib/http-client`
 * (see `@/test-utils/__mocks__` -> `mockHttpClientFactory`) and only need the
 * plain data fixtures below. The hook tests mock the service module entirely, so
 * they use the `*ServiceFactory` helpers, which return an object shaped like the
 * real service module with every method replaced by a `vi.fn()`.
 */

// ─── Ids ──────────────────────────────────────────────────────────────────────

export const MOCK_MONITOR_ID = "monitor-id-123";
export const MOCK_REPO_ID = "repo-id-123";
export const MOCK_BUILD_ID = "build-id-123";

// ─── Response fixtures ─────────────────────────────────────────────────────────

export const mockSuccessResponse = {
  isSuccess: true,
  statusCode: 200,
  data: {},
  errors: null,
};

export const mockDeleteSuccessResponse = {
  isSuccess: true,
  statusCode: 200,
  data: null,
  errors: null,
};

export const mockAlert = {
  itemId: MOCK_MONITOR_ID,
  repoId: MOCK_REPO_ID,
  name: "monitor",
  url: "https://test.com",
  isActive: true,
};

export const mockMonitorList = {
  isSuccess: true,
  statusCode: 200,
  data: [mockAlert],
  errors: null,
};

export const mockRepository = {
  id: MOCK_REPO_ID,
  name: "test-repo",
  full_name: "org/test-repo",
  private: false,
};

export const mockRepositories = {
  items: [mockRepository],
  total_count: 1,
};

export const mockRepositoryUser = {
  login: "test-user",
  id: 1,
  avatar_url: "https://avatar.test",
};

export const mockBranch = {
  name: "main",
  commit: { sha: "abc123" },
  protected: false,
};

// ─── Service module factories (for `vi.mock`) ──────────────────────────────────

export const mockAlertsServiceFactory = () => ({
  alertsService: {
    updateSingleMonitor: vi.fn(),
    deleteSingleMonitor: vi.fn(),
    getMonitorListById: vi.fn(),
    updateHealth: vi.fn(),
    deleteHealth: vi.fn(),
  },
});

export const mockGithubInfoServiceFactory = () => ({
  githubInfoService: {
    verifyAuthorization: vi.fn(),
    checkAlreadyAuthorization: vi.fn(),
    revokeAccess: vi.fn(),
    removeAuthorization: vi.fn(),
    getGithubRepos: vi.fn(),
    getRepositoryUser: vi.fn(),
    getGithubBranches: vi.fn(),
    getRepoAndGitBranchMatch: vi.fn(),
    cloneGithubRepo: vi.fn(),
    repoInitialDeploy: vi.fn(),
    manualDeploy: vi.fn(),
    getSpecs: vi.fn(),
    getAllRepos: vi.fn(),
    getAllRepoBuilds: vi.fn(),
    getAllProjects: vi.fn(),
    getRepoDetails: vi.fn(),
    getCardRepoAndBranches: vi.fn(),
    changeBuildSpecs: vi.fn(),
    updateRepoSettings: vi.fn(),
    getBuildLogs: vi.fn(),
    getRepoCardsAndBranches: vi.fn(),
  },
});

export const mockObservabilityServiceFactory = () => ({
  observabilityService: {
    SASTData: vi.fn(),
    SCAData: vi.fn(),
    SCARedirect: vi.fn(),
    SASTRedirect: vi.fn(),
  },
});
