import { describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { http } from "@/lib/http-client";
import { CLOUD_BUILD_ENDPOINTS } from "@blocks-devops/constants/endpoint.constant";
import { githubInfoService } from "./github-info.service";
import {
  mockRepository,
  mockRepositoryUser,
  mockBranch,
  MOCK_REPO_ID,
  MOCK_BUILD_ID,
  mockSuccessResponse,
} from "../test-utils/__mocks__";
import { TEST_PROJECT_KEY } from "@/test-utils/__mocks__/data.mock";

vi.mock("@/lib/http-client", () => mockHttpClientFactory());

describe("GithubInfoService", () => {
  // ─── verifyAuthorization ───────────────────────────────────────────────────

  describe("verifyAuthorization", () => {
    it("should call correct endpoint with code and projectKey", async () => {
      const mockResponse = "token-123";
      vi.mocked(http.get).mockResolvedValue(mockResponse);

      const code = "auth-code";
      const result = await githubInfoService.verifyAuthorization(code, TEST_PROJECT_KEY);

      const expectedUrl = `${CLOUD_BUILD_ENDPOINTS.ACCESS_TOKEN}?code=${encodeURIComponent(code)}&ProjectKey=${encodeURIComponent(TEST_PROJECT_KEY)}`;
      expect(http.get).toHaveBeenCalledWith(expectedUrl);
      expect(result).toEqual(mockResponse);
    });
  });

  // ─── checkAlreadyAuthorization ─────────────────────────────────────────────

  describe("checkAlreadyAuthorization", () => {
    it("should call correct endpoint", async () => {
      vi.mocked(http.get).mockResolvedValue(mockSuccessResponse);

      const result = await githubInfoService.checkAlreadyAuthorization();

      expect(http.get).toHaveBeenCalledWith(CLOUD_BUILD_ENDPOINTS.IS_AUTHORIZED);
      expect(result).toEqual(mockSuccessResponse);
    });
  });

  // ─── revokeAccess ──────────────────────────────────────────────────────────

  describe("revokeAccess", () => {
    it("should call correct endpoint", async () => {
      vi.mocked(http.post).mockResolvedValue(mockSuccessResponse);

      const result = await githubInfoService.revokeAccess();

      expect(http.post).toHaveBeenCalledWith(CLOUD_BUILD_ENDPOINTS.REMOVE_AUTHORIZATION, {});
      expect(result).toEqual(mockSuccessResponse);
    });
  });

  // ─── removeAuthorization ───────────────────────────────────────────────────

  describe("removeAuthorization", () => {
    it("should call correct endpoint", async () => {
      vi.mocked(http.post).mockResolvedValue(mockSuccessResponse);

      const result = await githubInfoService.removeAuthorization();

      expect(http.post).toHaveBeenCalledWith(CLOUD_BUILD_ENDPOINTS.REMOVE_ACCESS_TOKEN, {});
      expect(result).toEqual(mockSuccessResponse);
    });
  });

  // ─── getGithubRepos ────────────────────────────────────────────────────────

  describe("getGithubRepos", () => {
    it("should call correct endpoint with projectKey and search params", async () => {
      const mockResponse = {
        data: { items: [mockRepository], total_count: 1 },
        ...mockSuccessResponse,
      };
      vi.mocked(http.get).mockResolvedValue(mockResponse);

      const search = "repo";
      const pageNumber = 1;
      const pageSize = 10;
      const result = await githubInfoService.getGithubRepos(TEST_PROJECT_KEY, search, pageNumber, pageSize);

      const expectedUrl = `${CLOUD_BUILD_ENDPOINTS.GITHUB_REPOS}?ProjectKey=${encodeURIComponent(TEST_PROJECT_KEY)}&search=${encodeURIComponent(search)}&pageNumber=${pageNumber}&pageSize=${pageSize}`;
      expect(http.get).toHaveBeenCalledWith(expectedUrl);
      expect(result).toEqual(mockResponse);
    });

    it("should handle missing optional params", async () => {
      const mockResponse = { data: { items: [], total_count: 0 }, ...mockSuccessResponse };
      vi.mocked(http.get).mockResolvedValue(mockResponse);

      await githubInfoService.getGithubRepos(TEST_PROJECT_KEY);

      const expectedUrl = `${CLOUD_BUILD_ENDPOINTS.GITHUB_REPOS}?ProjectKey=${encodeURIComponent(TEST_PROJECT_KEY)}`;
      expect(http.get).toHaveBeenCalledWith(expectedUrl);
    });
  });

  // ─── getRepositoryUser ─────────────────────────────────────────────────────

  describe("getRepositoryUser", () => {
    it("should call correct endpoint with projectKey", async () => {
      vi.mocked(http.get).mockResolvedValue(mockRepositoryUser);

      const result = await githubInfoService.getRepositoryUser(TEST_PROJECT_KEY);

      const expectedUrl = `${CLOUD_BUILD_ENDPOINTS.GITHUB_USER}?ProjectKey=${encodeURIComponent(TEST_PROJECT_KEY)}`;
      expect(http.get).toHaveBeenCalledWith(expectedUrl);
      expect(result).toEqual(mockRepositoryUser);
    });
  });

  // ─── getGithubBranches ─────────────────────────────────────────────────────

  describe("getGithubBranches", () => {
    it("should call correct endpoint with repo and projectKey", async () => {
      const mockResponse = [mockBranch];
      vi.mocked(http.get).mockResolvedValue(mockResponse);

      const repo = "test-repo";
      const result = await githubInfoService.getGithubBranches(repo, TEST_PROJECT_KEY);

      const expectedUrl = `${CLOUD_BUILD_ENDPOINTS.GITHUB_BRANCHES}?repo=${encodeURIComponent(repo)}&ProjectKey=${encodeURIComponent(TEST_PROJECT_KEY)}`;
      expect(http.get).toHaveBeenCalledWith(expectedUrl);
      expect(result).toEqual(mockResponse);
    });
  });

  // ─── getRepoAndGitBranchMatch ──────────────────────────────────────────────

  describe("getRepoAndGitBranchMatch", () => {
    it("should call correct endpoint with repoId and projectKey", async () => {
      vi.mocked(http.get).mockResolvedValue(mockSuccessResponse);

      const result = await githubInfoService.getRepoAndGitBranchMatch(MOCK_REPO_ID, TEST_PROJECT_KEY);

      const expectedUrl = `${CLOUD_BUILD_ENDPOINTS.GITHUB_BRANCH_EXISTS}?repoId=${encodeURIComponent(MOCK_REPO_ID)}&ProjectKey=${encodeURIComponent(TEST_PROJECT_KEY)}`;
      expect(http.get).toHaveBeenCalledWith(expectedUrl);
      expect(result).toEqual(mockSuccessResponse);
    });
  });

  // ─── cloneGithubRepo ───────────────────────────────────────────────────────

  describe("cloneGithubRepo", () => {
    it("should call correct endpoint with payload", async () => {
      vi.mocked(http.post).mockResolvedValue(mockSuccessResponse);

      const payload = { repoName: "test", branch: "main", ProjectKey: TEST_PROJECT_KEY, deploymentUrl: "http", repoUrl: "http", projectName: "test" };
      const result = await githubInfoService.cloneGithubRepo(payload);

      expect(http.post).toHaveBeenCalledWith(CLOUD_BUILD_ENDPOINTS.BUILD_BUILD, payload);
      expect(result).toEqual(mockSuccessResponse);
    });
  });

  // ─── repoInitialDeploy ─────────────────────────────────────────────────────

  describe("repoInitialDeploy", () => {
    it("should call correct endpoint with payload", async () => {
      vi.mocked(http.post).mockResolvedValue(mockSuccessResponse);

      const payload = { some: "data" };
      const result = await githubInfoService.repoInitialDeploy(payload);

      expect(http.post).toHaveBeenCalledWith(CLOUD_BUILD_ENDPOINTS.RUN_BUILD, payload);
      expect(result).toEqual(mockSuccessResponse);
    });
  });

  // ─── manualDeploy ──────────────────────────────────────────────────────────

  describe("manualDeploy", () => {
    it("should call correct endpoint with payload", async () => {
      vi.mocked(http.post).mockResolvedValue(mockSuccessResponse);

      const payload = { repoId: MOCK_REPO_ID, ProjectKey: TEST_PROJECT_KEY };
      const result = await githubInfoService.manualDeploy(payload);

      expect(http.post).toHaveBeenCalledWith(CLOUD_BUILD_ENDPOINTS.MANUAL, payload);
      expect(result).toEqual(mockSuccessResponse);
    });
  });

  // ─── getSpecs ──────────────────────────────────────────────────────────────

  describe("getSpecs", () => {
    it("should call correct endpoint", async () => {
      const mockResponse = { data: [] };
      vi.mocked(http.get).mockResolvedValue(mockResponse);

      const result = await githubInfoService.getSpecs();

      expect(http.get).toHaveBeenCalledWith(CLOUD_BUILD_ENDPOINTS.SETTINGS);
      expect(result).toEqual(mockResponse);
    });
  });

  // ─── getAllRepos ───────────────────────────────────────────────────────────

  describe("getAllRepos", () => {
    it("should call correct endpoint with projectKey", async () => {
      const mockResponse: any[] = [];
      vi.mocked(http.get).mockResolvedValue(mockResponse);

      const result = await githubInfoService.getAllRepos(TEST_PROJECT_KEY);

      const expectedUrl = `${CLOUD_BUILD_ENDPOINTS.REPOS}?ProjectKey=${encodeURIComponent(TEST_PROJECT_KEY)}`;
      expect(http.get).toHaveBeenCalledWith(expectedUrl);
      expect(result).toEqual(mockResponse);
    });
  });

  // ─── getAllRepoBuilds ──────────────────────────────────────────────────────

  describe("getAllRepoBuilds", () => {
    it("should call correct endpoint with projectKey", async () => {
      const mockResponse: any[] = [];
      vi.mocked(http.get).mockResolvedValue(mockResponse);

      const result = await githubInfoService.getAllRepoBuilds(TEST_PROJECT_KEY);

      const expectedUrl = `${CLOUD_BUILD_ENDPOINTS.REPOS}?ProjectKey=${encodeURIComponent(TEST_PROJECT_KEY)}`;
      expect(http.get).toHaveBeenCalledWith(expectedUrl);
      expect(result).toEqual(mockResponse);
    });
  });

  // ─── getAllProjects ────────────────────────────────────────────────────────

  describe("getAllProjects", () => {
    it("should call correct endpoint with projectKey", async () => {
      const mockResponse: any[] = [];
      vi.mocked(http.get).mockResolvedValue(mockResponse);

      const result = await githubInfoService.getAllProjects(TEST_PROJECT_KEY);

      const expectedUrl = `${CLOUD_BUILD_ENDPOINTS.REPOS_LIST}?ProjectKey=${encodeURIComponent(TEST_PROJECT_KEY)}`;
      expect(http.get).toHaveBeenCalledWith(expectedUrl);
      expect(result).toEqual(mockResponse);
    });
  });

  // ─── getRepoDetails ────────────────────────────────────────────────────────

  describe("getRepoDetails", () => {
    it("should call correct endpoint with projectKey and repoId", async () => {
      const mockResponse = {};
      vi.mocked(http.get).mockResolvedValue(mockResponse);

      const result = await githubInfoService.getRepoDetails(TEST_PROJECT_KEY, MOCK_REPO_ID);

      const expectedUrl = `${CLOUD_BUILD_ENDPOINTS.REPO_DETAILS}?ProjectKey=${encodeURIComponent(TEST_PROJECT_KEY)}&RepoId=${encodeURIComponent(MOCK_REPO_ID)}`;
      expect(http.get).toHaveBeenCalledWith(expectedUrl);
      expect(result).toEqual(mockResponse);
    });
  });

  // ─── getCardRepoAndBranches ────────────────────────────────────────────────

  describe("getCardRepoAndBranches", () => {
    it("should call correct endpoint with buildId and projectKey", async () => {
      const mockResponse = {};
      vi.mocked(http.get).mockResolvedValue(mockResponse);

      const result = await githubInfoService.getCardRepoAndBranches(MOCK_BUILD_ID, TEST_PROJECT_KEY);

      const expectedUrl = `${CLOUD_BUILD_ENDPOINTS.BUILD}?buildId=${encodeURIComponent(MOCK_BUILD_ID)}&ProjectKey=${encodeURIComponent(TEST_PROJECT_KEY)}`;
      expect(http.get).toHaveBeenCalledWith(expectedUrl);
      expect(result).toEqual(mockResponse);
    });
  });

  // ─── changeBuildSpecs ──────────────────────────────────────────────────────

  describe("changeBuildSpecs", () => {
    it("should call correct endpoint with payload", async () => {
      vi.mocked(http.put).mockResolvedValue(mockSuccessResponse);

      const payload = {
        deploymentType: "manual" as const,
        hostingProviderId: "hp-1",
        machineConfigId: "mc-1",
        regionId: "reg-1",
        repoId: MOCK_REPO_ID
      };
      const result = await githubInfoService.changeBuildSpecs(payload);

      expect(http.put).toHaveBeenCalledWith(CLOUD_BUILD_ENDPOINTS.BUILD, payload);
      expect(result).toEqual(mockSuccessResponse);
    });
  });

  // ─── changeRepoSpecs ───────────────────────────────────────────────────────

  describe("changeRepoSpecs", () => {
    it("should call correct endpoint with payload", async () => {
      vi.mocked(http.post).mockResolvedValue(mockSuccessResponse);

      const payload = { repoId: MOCK_REPO_ID, projectKey: TEST_PROJECT_KEY, machineConfigId: "mc-1" };
      const result = await githubInfoService.changeRepoSpecs(payload);

      expect(http.post).toHaveBeenCalledWith(CLOUD_BUILD_ENDPOINTS.SETTINGS, payload);
      expect(result).toEqual(mockSuccessResponse);
    });
  });

  // ─── changeRepoSettings ────────────────────────────────────────────────────

  describe("changeRepoSettings", () => {
    it("should call correct endpoint with payload", async () => {
      vi.mocked(http.put).mockResolvedValue(mockSuccessResponse);

      const payload = {
        deploymentType: "manual" as const,
        hostingProviderId: "hp-1",
        machineConfigId: "mc-1",
        regionId: "reg-1",
        repoId: MOCK_REPO_ID
      };
      const result = await githubInfoService.changeRepoSettings(payload);

      expect(http.put).toHaveBeenCalledWith(CLOUD_BUILD_ENDPOINTS.SETTINGS, payload);
      expect(result).toEqual(mockSuccessResponse);
    });
  });

  // ─── getBuildLogs ──────────────────────────────────────────────────────────

  describe("getBuildLogs", () => {
    it("should call correct endpoint with repoId and projectKey", async () => {
      const mockResponse = {};
      vi.mocked(http.get).mockResolvedValue(mockResponse);

      const result = await githubInfoService.getBuildLogs(MOCK_REPO_ID, TEST_PROJECT_KEY);

      const expectedUrl = `${CLOUD_BUILD_ENDPOINTS.RUN_BUILD}?repoId=${MOCK_REPO_ID}&ProjectKey=${encodeURIComponent(TEST_PROJECT_KEY)}`;
      expect(http.get).toHaveBeenCalledWith(expectedUrl);
      expect(result).toEqual(mockResponse);
    });
  });

  // ─── getRepoCardsAndBranches ───────────────────────────────────────────────

  describe("getRepoCardsAndBranches", () => {
    it("should call correct endpoint with projectKey", async () => {
      const mockResponse = {};
      vi.mocked(http.get).mockResolvedValue(mockResponse);

      const result = await githubInfoService.getRepoCardsAndBranches(TEST_PROJECT_KEY);

      const expectedUrl = `${CLOUD_BUILD_ENDPOINTS.GITHUB_REPOS}?ProjectKey=${encodeURIComponent(TEST_PROJECT_KEY)}`;
      expect(http.get).toHaveBeenCalledWith(expectedUrl);
      expect(result).toEqual(mockResponse);
    });
  });
});
