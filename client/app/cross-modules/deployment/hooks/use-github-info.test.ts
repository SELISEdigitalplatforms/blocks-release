import { createWrapper } from "@/test-utils/test-providers/query-client";
import { renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
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
} from "./use-github-info";
import { TEST_PROJECT_KEY } from "@/test-utils/__mocks__/data.mock";

vi.mock("../services/github-info.service", () =>
  mockGithubInfoServiceFactory(),
);

describe("Github Info Hooks", () => {
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

    // H5/H6
    it("forwards branch and paging to the service", async () => {
      vi.mocked(githubInfoService.getRepoDetails).mockResolvedValue({} as any);

      const { result } = renderHook(
        () =>
          useGetRepoDetails(MOCK_REPO_ID, {
            branch: "develop",
            pageNumber: 1,
            pageSize: 1,
          }),
        { wrapper: createWrapper() },
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(githubInfoService.getRepoDetails).toHaveBeenCalledWith(MOCK_REPO_ID, {
        branch: "develop",
        pageNumber: 1,
        pageSize: 1,
      });
    });

    // H5: paging must produce a distinct cache entry, so a different page size fetches
    // again rather than reading the previous page's data.
    it("caches each page size separately", async () => {
      vi.mocked(githubInfoService.getRepoDetails).mockResolvedValue({} as any);
      const wrapper = createWrapper();

      const one = renderHook(
        () => useGetRepoDetails(MOCK_REPO_ID, { pageNumber: 1, pageSize: 1 }),
        { wrapper },
      );
      await waitFor(() => expect(one.result.current.isSuccess).toBe(true));

      const thirty = renderHook(
        () => useGetRepoDetails(MOCK_REPO_ID, { pageNumber: 1, pageSize: 30 }),
        { wrapper },
      );
      await waitFor(() => expect(thirty.result.current.isSuccess).toBe(true));

      expect(githubInfoService.getRepoDetails).toHaveBeenCalledTimes(2);
    });

    // H5: the must-not-break requirement. ["repo-details", repoId] has to stay a usable
    // invalidation prefix, which is why repoId keeps second position in the tuple. This
    // asserts the behaviour (a refetch happens) rather than comparing key arrays, since a
    // key that merely looks right can still fail prefix matching.
    it("still refetches when invalidated by the repoId prefix alone", async () => {
      vi.mocked(githubInfoService.getRepoDetails).mockResolvedValue({} as any);

      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);

      const { result } = renderHook(
        () =>
          useGetRepoDetails(MOCK_REPO_ID, {
            branch: "develop",
            pageNumber: 1,
            pageSize: 1,
          }),
        { wrapper },
      );
      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(githubInfoService.getRepoDetails).toHaveBeenCalledTimes(1);

      await queryClient.invalidateQueries({
        queryKey: ["repo-details", MOCK_REPO_ID],
      });

      await waitFor(() =>
        expect(githubInfoService.getRepoDetails).toHaveBeenCalledTimes(2),
      );
    });

    // C1: null and empty are tested independently, because the criterion names both.
    it("makes no request for an empty repoId", async () => {
      vi.mocked(githubInfoService.getRepoDetails).mockResolvedValue({} as any);

      renderHook(() => useGetRepoDetails(""), { wrapper: createWrapper() });

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(githubInfoService.getRepoDetails).not.toHaveBeenCalled();
    });

    it("makes no request for a null repoId", async () => {
      vi.mocked(githubInfoService.getRepoDetails).mockResolvedValue({} as any);

      renderHook(
        () => useGetRepoDetails(null as unknown as string),
        { wrapper: createWrapper() },
      );

      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(githubInfoService.getRepoDetails).not.toHaveBeenCalled();
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

      const { result } = renderHook(() => useUpdateRepoSettings({}), {
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
