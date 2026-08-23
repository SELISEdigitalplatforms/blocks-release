import { describe, expect, it, vi } from "vitest";
import { mockHttpClientFactory } from "@/test-utils/__mocks__";
import { http } from "@/lib/http-client";
import { CLOUD_BUILD_ENDPOINTS } from "@blocks-deployment/constants/endpoint.constant";
import { githubInfoService } from "./github-info.service";
import {
  mockRepository,
  mockRepositoryUser,
  mockBranch,
  MOCK_REPO_ID,
  MOCK_BUILD_ID,
  mockSuccessResponse,
} from "../test-utils/__mocks__";

vi.mock("@/lib/http-client", () => mockHttpClientFactory());

describe("GithubInfoService", () => {
  // ─── verifyAuthorization ───────────────────────────────────────────────────

  describe("verifyAuthorization", () => {
    it("should call correct endpoint with code", async () => {
      const mockResponse = "token-123";
      vi.mocked(http.get).mockResolvedValue(mockResponse);

      const code = "auth-code";
      const result = await githubInfoService.verifyAuthorization(code);

      const expectedUrl = `${CLOUD_BUILD_ENDPOINTS.ACCESS_TOKEN}?code=${encodeURIComponent(code)}`;
      expect(http.get).toHaveBeenCalledWith(expectedUrl);
      expect(result).toEqual(mockResponse);
    });
  });

  // ─── checkAlreadyAuthorization ─────────────────────────────────────────────

  describe("checkAlreadyAuthorization", () => {
    it("should call correct endpoint", async () => {
      vi.mocked(http.get).mockResolvedValue(mockSuccessResponse);

      const result = await githubInfoService.checkAlreadyAuthorization();

      expect(http.get).toHaveBeenCalledWith(
        CLOUD_BUILD_ENDPOINTS.IS_AUTHORIZED,
      );
      expect(result).toEqual(mockSuccessResponse);
    });
  });

  // ─── revokeAccess ──────────────────────────────────────────────────────────

  describe("revokeAccess", () => {
    it("should call correct endpoint", async () => {
      vi.mocked(http.post).mockResolvedValue(mockSuccessResponse);

      const result = await githubInfoService.revokeAccess();

      expect(http.post).toHaveBeenCalledWith(
        CLOUD_BUILD_ENDPOINTS.REMOVE_AUTHORIZATION,
        {},
      );
      expect(result).toEqual(mockSuccessResponse);
    });
  });

  // ─── removeAuthorization ───────────────────────────────────────────────────

  describe("removeAuthorization", () => {
    it("should call correct endpoint", async () => {
      vi.mocked(http.post).mockResolvedValue(mockSuccessResponse);

      const result = await githubInfoService.removeAuthorization();

      expect(http.post).toHaveBeenCalledWith(
        CLOUD_BUILD_ENDPOINTS.REMOVE_ACCESS_TOKEN,
        {},
      );
      expect(result).toEqual(mockSuccessResponse);
    });
  });

  // ─── getGithubRepos ────────────────────────────────────────────────────────

  describe("getGithubRepos", () => {
    it("should call correct endpoint with search params", async () => {
      const mockResponse = {
        data: { items: [mockRepository], total_count: 1 },
        ...mockSuccessResponse,
      };
      vi.mocked(http.get).mockResolvedValue(mockResponse);

      const search = "repo";
      const pageNumber = 1;
      const pageSize = 10;
      const result = await githubInfoService.getGithubRepos(
        search,
        pageNumber,
        pageSize,
      );

      const expectedUrl = `${CLOUD_BUILD_ENDPOINTS.GITHUB_REPOS}?search=${encodeURIComponent(search)}&pageNumber=${pageNumber}&pageSize=${pageSize}`;
      expect(http.get).toHaveBeenCalledWith(expectedUrl);
      expect(result).toEqual(mockResponse);
    });

    it("should handle missing optional params", async () => {
      const mockResponse = {
        data: { items: [], total_count: 0 },
        ...mockSuccessResponse,
      };
      vi.mocked(http.get).mockResolvedValue(mockResponse);

      await githubInfoService.getGithubRepos();

      expect(http.get).toHaveBeenCalledWith(CLOUD_BUILD_ENDPOINTS.GITHUB_REPOS);
    });
  });

  // ─── getRepositoryUser ─────────────────────────────────────────────────────

  describe("getRepositoryUser", () => {
    it("should call correct endpoint", async () => {
      vi.mocked(http.get).mockResolvedValue(mockRepositoryUser);

      const result = await githubInfoService.getRepositoryUser();

      expect(http.get).toHaveBeenCalledWith(CLOUD_BUILD_ENDPOINTS.GITHUB_USER);
      expect(result).toEqual(mockRepositoryUser);
    });
  });

  // ─── getGithubBranches ─────────────────────────────────────────────────────

  describe("getGithubBranches", () => {
    it("should call correct endpoint with repo", async () => {
      const mockResponse = [mockBranch];
      vi.mocked(http.get).mockResolvedValue(mockResponse);

      const repo = "test-repo";
      const result = await githubInfoService.getGithubBranches(repo);

      const expectedUrl = `${CLOUD_BUILD_ENDPOINTS.GITHUB_BRANCHES}?repo=${encodeURIComponent(repo)}`;
      expect(http.get).toHaveBeenCalledWith(expectedUrl);
      expect(result).toEqual(mockResponse);
    });
  });

  // ─── getRepoAndGitBranchMatch ──────────────────────────────────────────────

  describe("getRepoAndGitBranchMatch", () => {
    it("should call correct endpoint with repoId", async () => {
      vi.mocked(http.get).mockResolvedValue(mockSuccessResponse);

      const result =
        await githubInfoService.getRepoAndGitBranchMatch(MOCK_REPO_ID);

      const expectedUrl = `${CLOUD_BUILD_ENDPOINTS.GITHUB_BRANCH_EXISTS}?repoId=${encodeURIComponent(MOCK_REPO_ID)}`;
      expect(http.get).toHaveBeenCalledWith(expectedUrl);
      expect(result).toEqual(mockSuccessResponse);
    });
  });

  // ─── cloneGithubRepo ───────────────────────────────────────────────────────

  describe("cloneGithubRepo", () => {
    it("should call correct endpoint with payload", async () => {
      vi.mocked(http.post).mockResolvedValue(mockSuccessResponse);

      const payload = {
        repoName: "test",
        branch: "main",
        deploymentUrl: "http",
        repoUrl: "http",
        projectName: "test",
      };
      const result = await githubInfoService.cloneGithubRepo(payload);

      expect(http.post).toHaveBeenCalledWith(
        CLOUD_BUILD_ENDPOINTS.BUILD_BUILD,
        payload,
      );
      expect(result).toEqual(mockSuccessResponse);
    });
  });

  // ─── repoInitialDeploy ─────────────────────────────────────────────────────

  describe("repoInitialDeploy", () => {
    it("should call correct endpoint with payload", async () => {
      vi.mocked(http.post).mockResolvedValue(mockSuccessResponse);

      const payload = { some: "data" };
      const result = await githubInfoService.repoInitialDeploy(payload);

      expect(http.post).toHaveBeenCalledWith(
        CLOUD_BUILD_ENDPOINTS.RUN_BUILD,
        payload,
      );
      expect(result).toEqual(mockSuccessResponse);
    });
  });

  // ─── manualDeploy ──────────────────────────────────────────────────────────

  describe("manualDeploy", () => {
    it("should call correct endpoint with payload", async () => {
      vi.mocked(http.post).mockResolvedValue(mockSuccessResponse);

      const payload = { repoId: MOCK_REPO_ID };
      const result = await githubInfoService.manualDeploy(payload);

      expect(http.post).toHaveBeenCalledWith(
        CLOUD_BUILD_ENDPOINTS.MANUAL,
        payload,
      );
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
    it("should call correct endpoint", async () => {
      const mockResponse: any[] = [];
      vi.mocked(http.get).mockResolvedValue(mockResponse);

      const result = await githubInfoService.getAllRepos();

      expect(http.get).toHaveBeenCalledWith(CLOUD_BUILD_ENDPOINTS.REPOS);
      expect(result).toEqual(mockResponse);
    });
  });

  // ─── getAllRepoBuilds ──────────────────────────────────────────────────────

  describe("getAllRepoBuilds", () => {
    it("should call correct endpoint", async () => {
      const mockResponse: any[] = [];
      vi.mocked(http.get).mockResolvedValue(mockResponse);

      const result = await githubInfoService.getAllRepoBuilds();

      expect(http.get).toHaveBeenCalledWith(CLOUD_BUILD_ENDPOINTS.REPOS);
      expect(result).toEqual(mockResponse);
    });
  });

  // ─── getAllProjects ────────────────────────────────────────────────────────

  describe("getAllProjects", () => {
    it("should call correct endpoint", async () => {
      const mockResponse: any[] = [];
      vi.mocked(http.get).mockResolvedValue(mockResponse);

      const result = await githubInfoService.getAllProjects();

      expect(http.get).toHaveBeenCalledWith(CLOUD_BUILD_ENDPOINTS.REPOS_LIST);
      expect(result).toEqual(mockResponse);
    });
  });

  // ─── getRepoDetails ────────────────────────────────────────────────────────

  describe("getRepoDetails", () => {
    it("should call correct endpoint with repoId", async () => {
      const mockResponse = {};
      vi.mocked(http.get).mockResolvedValue(mockResponse);

      const result = await githubInfoService.getRepoDetails(MOCK_REPO_ID);

      const expectedUrl = `${CLOUD_BUILD_ENDPOINTS.REPO_DETAILS}?RepoId=${encodeURIComponent(MOCK_REPO_ID)}`;
      expect(http.get).toHaveBeenCalledWith(expectedUrl);
      expect(result).toEqual(mockResponse);
    });

    // H6
    it("puts branch, pageNumber and pageSize on the query string", async () => {
      vi.mocked(http.get).mockResolvedValue({});

      await githubInfoService.getRepoDetails(MOCK_REPO_ID, {
        branch: "develop",
        pageNumber: 2,
        pageSize: 30,
      });

      const url = vi.mocked(http.get).mock.calls[0][0] as string;
      expect(url).toContain(`RepoId=${encodeURIComponent(MOCK_REPO_ID)}`);
      expect(url).toContain("branch=develop");
      expect(url).toContain("pageNumber=2");
      expect(url).toContain("pageSize=30");
    });

    it("encodes a branch name containing a slash", async () => {
      vi.mocked(http.get).mockResolvedValue({});

      await githubInfoService.getRepoDetails(MOCK_REPO_ID, {
        branch: "feature/new-thing",
      });

      const url = vi.mocked(http.get).mock.calls[0][0] as string;
      // Unencoded, the slash would read as a path segment rather than a value.
      expect(url).toContain("branch=feature%2Fnew-thing");
      expect(url).not.toContain("branch=feature/new-thing");
    });

    it("sends pageSize 0 rather than dropping it", async () => {
      vi.mocked(http.get).mockResolvedValue({});

      await githubInfoService.getRepoDetails(MOCK_REPO_ID, { pageSize: 0 });

      // A truthiness check would omit this and silently fall back to the server default
      // of 30 instead of the clamped 1 the caller would actually get.
      const url = vi.mocked(http.get).mock.calls[0][0] as string;
      expect(url).toContain("pageSize=0");
    });

    it("omits parameters that were not supplied", async () => {
      vi.mocked(http.get).mockResolvedValue({});

      await githubInfoService.getRepoDetails(MOCK_REPO_ID, { pageSize: 1 });

      const url = vi.mocked(http.get).mock.calls[0][0] as string;
      expect(url).toContain("pageSize=1");
      expect(url).not.toContain("branch=");
      expect(url).not.toContain("pageNumber=");
    });
  });

  // ─── getCardRepoAndBranches ────────────────────────────────────────────────

  describe("getCardRepoAndBranches", () => {
    it("should call correct endpoint with buildId", async () => {
      const mockResponse = {};
      vi.mocked(http.get).mockResolvedValue(mockResponse);

      const result =
        await githubInfoService.getCardRepoAndBranches(MOCK_BUILD_ID);

      const expectedUrl = `${CLOUD_BUILD_ENDPOINTS.BUILD}?buildId=${encodeURIComponent(MOCK_BUILD_ID)}`;
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
        repoId: MOCK_REPO_ID,
      };
      const result = await githubInfoService.changeBuildSpecs(payload);

      expect(http.put).toHaveBeenCalledWith(
        CLOUD_BUILD_ENDPOINTS.BUILD,
        payload,
      );
      expect(result).toEqual(mockSuccessResponse);
    });
  });

  // ─── updateRepoSettings ───────────────────────────────────────────────────────

  describe("updateRepoSettings", () => {
    it("should call correct endpoint with payload", async () => {
      vi.mocked(http.post).mockResolvedValue(mockSuccessResponse);

      const payload = {
        repoId: MOCK_REPO_ID,
        machineConfigId: "mc-1",
      };
      const result = await githubInfoService.updateRepoSettings(payload);

      expect(http.post).toHaveBeenCalledWith(
        CLOUD_BUILD_ENDPOINTS.REPO_SETTINGS_UPDATE,
        payload,
      );
      expect(result).toEqual(mockSuccessResponse);
    });
  });

  // ─── getBuildLogs ──────────────────────────────────────────────────────────

  describe("getBuildLogs", () => {
    it("should call correct endpoint with repoId", async () => {
      const mockResponse = {};
      vi.mocked(http.get).mockResolvedValue(mockResponse);

      const result = await githubInfoService.getBuildLogs(MOCK_REPO_ID);

      const expectedUrl = `${CLOUD_BUILD_ENDPOINTS.RUN_BUILD}?repoId=${MOCK_REPO_ID}`;
      expect(http.get).toHaveBeenCalledWith(expectedUrl);
      expect(result).toEqual(mockResponse);
    });
  });

  // ─── getRepoCardsAndBranches ───────────────────────────────────────────────

  describe("getRepoCardsAndBranches", () => {
    it("should call correct endpoint", async () => {
      const mockResponse = {};
      vi.mocked(http.get).mockResolvedValue(mockResponse);

      const result = await githubInfoService.getRepoCardsAndBranches();

      expect(http.get).toHaveBeenCalledWith(CLOUD_BUILD_ENDPOINTS.GITHUB_REPOS);
      expect(result).toEqual(mockResponse);
    });
  });
});
