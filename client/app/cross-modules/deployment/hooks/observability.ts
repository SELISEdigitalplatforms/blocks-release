import { useProjectStore } from "@/store/useProjectStore";
import { observabilityService } from "@blocks-deployment/services/observability.service";
import { useQuery } from "@tanstack/react-query";

export const useGetSASTData = (buildId: string) => {
  const projectKey = useProjectStore().selectedProject?.tenantId || "";

  return useQuery({
    queryKey: ["SAST", buildId],
    queryFn: async () => {
      const result = await observabilityService.SASTData(buildId, projectKey);
      //   const result = await observabilityService.SASTData(buildId, type, projectKey);
      return result;
    },
    enabled: !!buildId,
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });
};
export const useGetSCALibraryData = (buildId: string) => {
  const projectKey = useProjectStore().selectedProject?.tenantId || "";

  return useQuery({
    queryKey: ["SCA-library", buildId],
    queryFn: async () => {
      const result = await observabilityService.SCAData(
        buildId,
        projectKey,
        "libraries",
      );
      return result;
    },
    enabled: !!buildId,
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });
};
export const useGetSCADContainerData = (buildId: string) => {
  const projectKey = useProjectStore().selectedProject?.tenantId || "";

  return useQuery({
    queryKey: ["SCA-container", buildId],
    queryFn: async () => {
      const result = await observabilityService.SCAData(
        buildId,
        projectKey,
        "container",
      );
      return result;
    },
    enabled: !!buildId,
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });
};

export const useSCARedirectLink = (buildId: string) => {
  const projectKey = useProjectStore().selectedProject?.tenantId || "";

  return useQuery({
    queryKey: ["SCA-redirect", buildId],
    queryFn: async () => {
      const result = await observabilityService.SCARedirect(
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
