import { createWrapper } from "@/test-utils/test-providers/query-client";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  mockRepository,
  mockRepositories,
  mockRepositoryUser,
  mockBranch,
  MOCK_REPO_ID,
  MOCK_BUILD_ID,
  mockSuccessResponse,
  mockGithubInfoServiceFactory,
} from "../test-utils/__mocks__";
import { githubInfoService } from "../services/github-info.service";
import { useProjectStore } from "@/modules/identifier/state/use-project-store";
import {
  useGithubVerification,
  useValidateAuthorization,
  useRevokeAccess,
  useGetGithubRepos,
  useGetRepositoryUser,
  useRemoveAuthorization,
  useGithubBranches,
  useRepoAndGitBranchMatch,
  useInitialRepoDeployment,
  useManualDeployment,
  useGetSpecs,
  useGetAllRepoBuilds,
  useGetAllProjects,
  useGetRepoDetails,
  useGetCardProjectAndBranch,
  useChangeBuildSpecs,
  useUpdateRepoSettings,
} from "./github-info";
import { TEST_PROJECT_KEY } from "@/test-utils/__mocks__/data.mock";

vi.mock("../services/github-info.service", () =>
  mockGithubInfoServiceFactory(),
);
vi.mock("@/modules/identifier/state/use-project-store", () => ({
  useProjectStore: vi.fn(),
}));

describe("Github Info Hooks", () => {
  beforeEach(() => {
    vi.mocked(useProjectStore).mockReturnValue({
      selectedProject: { tenantId: TEST_PROJECT_KEY },
    } as any);
  });

  // ─── useGithubVerification ─────────────────────────────────────────────────

  describe("useGithubVerification", () => {
    it("should verify github code successfully", async () => {
      const code = "auth-code";
      vi.mocked(githubInfoService.verifyAuthorization).mockResolvedValue(
        "token-123",
      );

      const { result } = renderHook(() => useGithubVerification(code), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toBe("token-123");
      expect(githubInfoService.verifyAuthorization).toHaveBeenCalledWith(code);
    });
  });

  // ─── useValidateAuthorization ─────────────────────────────────────────────

  describe("useValidateAuthorization", () => {
    it("should validate authorization successfully", async () => {
      vi.mocked(githubInfoService.checkAlreadyAuthorization).mockResolvedValue({
        isSuccess: true,
      });

      const { result } = renderHook(() => useValidateAuthorization(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({ isSuccess: true });
    });
  });

  // ─── useGetGithubRepos ─────────────────────────────────────────────────────

  describe("useGetGithubRepos", () => {
    it("should fetch github repos successfully", async () => {
      const mockResponse = {
        data: { items: [mockRepository], total_count: 1 },
        isSuccess: true,
      };
      vi.mocked(githubInfoService.getGithubRepos).mockResolvedValue(
        mockResponse as any,
      );

      const { result } = renderHook(() => useGetGithubRepos(true), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
    });

    it("should not fetch when not enabled", () => {
      const { result } = renderHook(() => useGetGithubRepos(false), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
      expect(githubInfoService.getGithubRepos).not.toHaveBeenCalled();
    });
  });

  // ─── useManualDeployment ───────────────────────────────────────────────────

  describe("useManualDeployment", () => {
    it("should trigger manual deployment successfully", async () => {
      const payload = { repoId: MOCK_REPO_ID };
      vi.mocked(githubInfoService.manualDeploy).mockResolvedValue(
        mockSuccessResponse as any,
      );

      const { result } = renderHook(() => useManualDeployment(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(payload);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(githubInfoService.manualDeploy).toHaveBeenCalledWith(payload);
    });
  });

  // ─── useGetCardProjectAndBranch ────────────────────────────────────────────

  describe("useGetCardProjectAndBranch", () => {
    it("should fetch card project and branch successfully", async () => {
      vi.mocked(githubInfoService.getCardRepoAndBranches).mockResolvedValue({
        isSuccess: true,
      } as any);

      const { result } = renderHook(
        () => useGetCardProjectAndBranch(MOCK_BUILD_ID),
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(githubInfoService.getCardRepoAndBranches).toHaveBeenCalledWith(
        MOCK_BUILD_ID,
      );
    });
  });

  // ─── useRevokeAccess ───────────────────────────────────────────────────────

  describe("useRevokeAccess", () => {
    it("should revoke access successfully", async () => {
      vi.mocked(githubInfoService.revokeAccess).mockResolvedValue(
        mockSuccessResponse as any,
      );

      const { result } = renderHook(() => useRevokeAccess(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockSuccessResponse);
      expect(githubInfoService.revokeAccess).toHaveBeenCalled();
    });
  });

  // ─── useGetRepositoryUser ──────────────────────────────────────────────────

  describe("useGetRepositoryUser", () => {
    it("should fetch repository user successfully", async () => {
      vi.mocked(githubInfoService.getRepositoryUser).mockResolvedValue(
        mockRepositoryUser,
      );

      const { result } = renderHook(() => useGetRepositoryUser(true), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockRepositoryUser);
      expect(githubInfoService.getRepositoryUser).toHaveBeenCalledWith();
    });
  });

  // ─── useRemoveAuthorization ───────────────────────────────────────────────

  describe("useRemoveAuthorization", () => {
    it("should remove authorization successfully", async () => {
      vi.mocked(githubInfoService.removeAuthorization).mockResolvedValue(
        mockSuccessResponse as any,
      );

      const { result } = renderHook(() => useRemoveAuthorization(), {
        wrapper: createWrapper(),
      });

      result.current.mutate();

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(githubInfoService.removeAuthorization).toHaveBeenCalled();
    });
  });

  // ─── useGithubBranches ────────────────────────────────────────────────────

  describe("useGithubBranches", () => {
    it("should fetch github branches successfully", async () => {
      const mockBranches = [mockBranch];
      vi.mocked(githubInfoService.getGithubBranches).mockResolvedValue(
        mockBranches as any,
      );

      const { result } = renderHook(() => useGithubBranches("repo-name"), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockBranches);
      expect(githubInfoService.getGithubBranches).toHaveBeenCalledWith(
        "repo-name",
      );
    });
  });

  // ─── useRepoAndGitBranchMatch ──────────────────────────────────────────────

  describe("useRepoAndGitBranchMatch", () => {
    it("should check repo and branch match successfully", async () => {
      vi.mocked(githubInfoService.getRepoAndGitBranchMatch).mockResolvedValue(
        mockSuccessResponse as any,
      );

      const { result } = renderHook(
        () => useRepoAndGitBranchMatch(MOCK_REPO_ID),
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockSuccessResponse);
      expect(githubInfoService.getRepoAndGitBranchMatch).toHaveBeenCalledWith(
        MOCK_REPO_ID,
      );
    });
  });

  // ─── useInitialRepoDeployment ─────────────────────────────────────────────

  describe("useInitialRepoDeployment", () => {
    it("should trigger initial repo deployment successfully", async () => {
      const payload = {
        repoId: MOCK_REPO_ID,
        machineConfigId: "mc-1",
      };
      vi.mocked(githubInfoService.repoInitialDeploy).mockResolvedValue(
        mockSuccessResponse as any,
      );

      const { result } = renderHook(() => useInitialRepoDeployment(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(payload);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(githubInfoService.repoInitialDeploy).toHaveBeenCalledWith(payload);
    });
  });

  // ─── useGetSpecs ──────────────────────────────────────────────────────────

  describe("useGetSpecs", () => {
    it("should fetch specs successfully", async () => {
      const mockSpecs = { data: [] };
      vi.mocked(githubInfoService.getSpecs).mockResolvedValue(mockSpecs as any);

      const { result } = renderHook(() => useGetSpecs(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockSpecs);
      expect(githubInfoService.getSpecs).toHaveBeenCalled();
    });
  });

  // ─── useGetAllRepoBuilds ──────────────────────────────────────────────────

  describe("useGetAllRepoBuilds", () => {
    it("should fetch all repo builds successfully", async () => {
      const mockBuilds = [mockRepositories];
      vi.mocked(githubInfoService.getAllRepoBuilds).mockResolvedValue(
        mockBuilds as any,
      );

      const { result } = renderHook(
        () => useGetAllRepoBuilds(TEST_PROJECT_KEY),
        {
          wrapper: createWrapper(),
        },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockBuilds);
      expect(githubInfoService.getAllRepoBuilds).toHaveBeenCalledWith();
    });
  });

  // ─── useGetAllProjects ────────────────────────────────────────────────────

  describe("useGetAllProjects", () => {
    it("should fetch all projects successfully", async () => {
      const mockProjects = [mockRepositories];
      vi.mocked(githubInfoService.getAllProjects).mockResolvedValue(
        mockProjects as any,
      );

      const { result } = renderHook(() => useGetAllProjects(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockProjects);
      expect(githubInfoService.getAllProjects).toHaveBeenCalledWith();
    });
  });

  // ─── useGetRepoDetails ────────────────────────────────────────────────────

  describe("useGetRepoDetails", () => {
    it("should fetch repo details successfully", async () => {
      const mockDetails = {};
      vi.mocked(githubInfoService.getRepoDetails).mockResolvedValue(
        mockDetails as any,
      );

      const { result } = renderHook(() => useGetRepoDetails(MOCK_REPO_ID), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockDetails);
      expect(githubInfoService.getRepoDetails).toHaveBeenCalledWith(
        MOCK_REPO_ID,
      );
    });
  });

  // ─── useChangeBuildSpecs ──────────────────────────────────────────────────

  describe("useChangeBuildSpecs", () => {
    it("should change build specs successfully", async () => {
      const payload = {
        deploymentType: "manual" as const,
        hostingProviderId: "hp-1",
        machineConfigId: "mc-1",
        regionId: "reg-1",
        repoId: MOCK_REPO_ID,
      };
      vi.mocked(githubInfoService.changeBuildSpecs).mockResolvedValue(
        mockSuccessResponse as any,
      );

      const { result } = renderHook(() => useChangeBuildSpecs(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(payload);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(githubInfoService.changeBuildSpecs).toHaveBeenCalledWith(payload);
    });
  });

  // ─── useUpdateRepoSettings ───────────────────────────────────────────────────

  describe("useUpdateRepoSettings", () => {
    it("should change repo specs successfully", async () => {
      const payload = {
        repoId: MOCK_REPO_ID,
        machineConfigId: "mc-1",
      };
      vi.mocked(githubInfoService.updateRepoSettings).mockResolvedValue(
        mockSuccessResponse as any,
      );

      const { result } = renderHook(() => useUpdateRepoSettings(), {
        wrapper: createWrapper(),
      });

      result.current.mutate(payload);

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(githubInfoService.updateRepoSettings).toHaveBeenCalledWith(
        payload,
      );
    });
  });
});
