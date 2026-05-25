import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { githubInfoService } from "../services/github-info.service";
import { IBuildApiResponse } from "@blocks-deployment/models/deployed-logs";
import type {
  IChangeRepoSpecs,
  IChangeSettings,
  IManualDeploymentPayload,
  IUpdateRepoSettingsPayload,
} from "@blocks-deployment/models/utils";
import { useProjectStore } from "@/store/project.store";

export const useGithubVerification = (code: string) => {
  const projectKey = useProjectStore().selectedProject?.tenantId || "";

  return useQuery({
    queryKey: ["github-verification", code],
    queryFn: () => githubInfoService.verifyAuthorization(code, projectKey),
  });
};
export const useValidateAuthorization = () => {
  return useQuery({
    queryKey: ["verify-auth"],
    queryFn: () => githubInfoService.checkAlreadyAuthorization(),
    retry: false,
  });
};

export const useRevokeAccess = () => {
  return useQuery({
    queryKey: ["revoke-access"],
    queryFn: () => githubInfoService.revokeAccess(),
    retry: false,
  });
};

export const useGetGithubRepos = (
  isVerificationSuccessful: boolean,
  search?: string,
  page?: number,
  perPage?: number,
) => {
  return useQuery({
    queryKey: ["github-repos", isVerificationSuccessful, search, page, perPage],
    queryFn: () => githubInfoService.getGithubRepos(search, page, perPage),
    enabled: isVerificationSuccessful,
    retry: false,
    staleTime: 0, // Always fetch fresh data
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
};

export const useGetRepositoryUser = (isVerificationSuccessful: boolean) => {
  return useQuery({
    queryKey: ["repository-user", isVerificationSuccessful],
    queryFn: () => githubInfoService.getRepositoryUser(),
    enabled: isVerificationSuccessful,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
};

export const useRemoveAuthorization = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["remove-authorization"],
    mutationFn: githubInfoService.removeAuthorization,
    onSuccess: () => {
      // queryClient.invalidateQueries({ queryKey: ["verify-auth"] });
      // queryClient.invalidateQueries({ queryKey: ["github-repos"] });
      // queryClient.invalidateQueries({ queryKey: ["repository-user"] });
      console.log("Authorization removed successfully");
      queryClient.setQueryData(["verify-auth"], () => undefined);
      queryClient.setQueryData(["github-repos"], () => []);
      queryClient.setQueryData(["repository-user"], () => undefined);
    },
  });
};

export const useGithubBranches = (repo: string) => {
  return useQuery({
    queryKey: ["github-branches", repo],
    queryFn: () => githubInfoService.getGithubBranches(repo),
    enabled: !!repo,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
};

export const useRepoAndGitBranchMatch = (
  repoId: string,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: ["git-branch-match", repoId],
    queryFn: () => githubInfoService.getRepoAndGitBranchMatch(repoId),
    enabled: !!repoId && enabled,
    retry: false,
    refetchOnMount: true,
  });
};

export const useGetAllProjects = (options?: {
  refetchOnMount: boolean;
  refetchOnWindowFocus: boolean;
  forceRefresh?: boolean;
}) => {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => githubInfoService.getAllProjects(),
    retry: false,
    staleTime: options?.forceRefresh ? 0 : 5 * 60 * 1000,
    refetchOnMount: options?.refetchOnMount ? "always" : true,
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false,
  });
};

export const useGetAllRepoBuilds = (
  projectId: string,
  options?: {
    refetchOnMount: boolean;
    refetchOnWindowFocus: boolean;
    forceRefresh?: boolean;
  },
) => {
  return useQuery({
    queryKey: ["repo-builds", projectId],
    queryFn: () => {
      if (!projectId) {
        throw new Error("Project ID is required");
      }
      return githubInfoService.getAllRepoBuilds(projectId);
    },
    enabled: !!projectId,
    retry: false,
    staleTime: options?.forceRefresh ? 0 : 5 * 60 * 1000,
    refetchOnMount: options?.refetchOnMount ? "always" : true,
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false,
  });
};

export const useGetRepoDetails = (
  repoId: string,
  options?: {
    refetchOnMount: boolean;
    refetchOnWindowFocus: boolean;
    forceRefresh?: boolean;
  },
) => {
  return useQuery({
    queryKey: ["repo-details", repoId],
    queryFn: () => {
      if (!repoId) {
        throw new Error("Repo ID is required");
      }
      return githubInfoService.getRepoDetails(repoId);
    },
    enabled: !!repoId,
    staleTime: options?.forceRefresh ? 0 : 5 * 60 * 1000,
    refetchOnMount: options?.refetchOnMount ? "always" : true,
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false,
    retry: false,
  });
};

export const useInitialRepoDeployment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: IChangeRepoSpecs) =>
      githubInfoService.repoInitialDeploy(payload),
    onSuccess: (data) => {
      queryClient.setQueryData(["repo-id"], data);
      queryClient.invalidateQueries({ queryKey: ["repo-details"] });
    },
    onError: (error) => {
      console.error("Repo initial deployment failed:", error);
    },
  });
};

export const useManualDeployment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (options: IManualDeploymentPayload) =>
      githubInfoService.manualDeploy(options),
    onSuccess: (data) => {
      queryClient.setQueryData(["repo-id"], data);

      queryClient.invalidateQueries({ queryKey: ["github-repos"] });
    },
    onError: (error) => {
      console.error("Manual Clone failed:", error);
    },
  });
};
export const useGetSpecs = () => {
  return useQuery({
    queryKey: ["specs"],
    queryFn: () => githubInfoService.getSpecs(), // or whatever service contains getSpecs
    // enabled: isVerificationSuccessful,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
};

export const useGetCardProjectAndBranch = (buildId: string) => {
  return useQuery<IBuildApiResponse>({
    queryKey: ["project-repo", buildId],
    queryFn: () => {
      if (!buildId) {
        throw new Error("Build ID is required");
      }
      return githubInfoService.getCardRepoAndBranches(buildId);
    },
    enabled: !!buildId,
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
};

export const useChangeBuildSpecs = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: IChangeSettings) =>
      githubInfoService.changeBuildSpecs(payload),
    onSuccess: (data) => {
      queryClient.setQueryData(["build-specs"], data);

      queryClient.invalidateQueries({ queryKey: ["repo-specs"] });
      queryClient.invalidateQueries({ queryKey: ["repo-builds"] });
    },
    onError: (error) => {
      console.error("Build specs change failed:", error);
    },
  });
};

export const useUpdateRepoSettings = ({
  onSuccess,
  onError,
}: {
  onSuccess?: () => void;
  onError?: () => void;
}) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: IUpdateRepoSettingsPayload) =>
      githubInfoService.updateRepoSettings(payload),
    onSuccess: (data) => {
      queryClient.setQueryData(["repo-specs"], data);
      queryClient.invalidateQueries({ queryKey: ["repo-builds"] });
      queryClient.invalidateQueries({ queryKey: ["repo-details"] });
      onSuccess?.();
    },
    onError: () => {
      onError?.();
    },
  });
};
