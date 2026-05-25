import { useProjectStore } from "@/store/project.store";
import { observabilityService } from "@blocks-deployment/services/observability.service";
import { useQuery } from "@tanstack/react-query";

export const useGetSASTData = (buildId: string) => {
  return useQuery({
    queryKey: ["SAST", buildId],
    queryFn: () => observabilityService.SASTData(buildId),
    enabled: !!buildId,
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });
};
export const useGetSCALibraryData = (buildId: string) => {
  return useQuery({
    queryKey: ["SCA-library", buildId],
    queryFn: () => observabilityService.SCAData(buildId, "libraries"),
    enabled: !!buildId,
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });
};
export const useGetSCADContainerData = (buildId: string) => {
  return useQuery({
    queryKey: ["SCA-container", buildId],
    queryFn: () => observabilityService.SCAData(buildId, "container"),
    enabled: !!buildId,
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });
};

export const useSCARedirectLink = (buildId: string) => {
  return useQuery({
    queryKey: ["SCA-redirect", buildId],
    queryFn: () => observabilityService.SCARedirect(buildId),
    enabled: !!buildId,
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });
};

export const useSASTRedirectLink = (buildId: string) => {
  const projectKey = useProjectStore().selectedProject?.tenantId || "";

  return useQuery({
    queryKey: ["SAST-redirect", buildId],
    queryFn: async () => {
      const result = await observabilityService.SASTRedirect(
        buildId,
        projectKey,
      );
      return result;
    },
    enabled: !!buildId,
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });
};
