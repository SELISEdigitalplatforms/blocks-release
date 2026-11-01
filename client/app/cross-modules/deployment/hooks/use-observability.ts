import { observabilityService } from "@blocks-deployment/services/observability.service";
import type { ReportStatus } from "@blocks-deployment/models/sca-report";
import { useQuery } from "@tanstack/react-query";

export const REPORT_POLL_INTERVAL_MS = 30_000;

/** Re-polls a saved report every 30 s while the build is still capturing it. */
export const getReportRefetchInterval = (query: {
  state: { data?: { data?: { status?: ReportStatus | null } | null } };
}): number | false =>
  query.state.data?.data?.status === "Pending" ? REPORT_POLL_INTERVAL_MS : false;

export const useGetSASTData = (buildId: string) => {
  return useQuery({
    queryKey: ["SAST", buildId],
    queryFn: () => observabilityService.SASTData(buildId),
    enabled: !!buildId,
    retry: 2,
    staleTime: 5 * 60 * 1000,
    refetchInterval: getReportRefetchInterval,
    refetchIntervalInBackground: false,
  });
};
export const useGetSCALibraryData = (buildId: string) => {
  return useQuery({
    queryKey: ["SCA-library", buildId],
    queryFn: () => observabilityService.SCAData(buildId, "libraries"),
    enabled: !!buildId,
    retry: 2,
    staleTime: 5 * 60 * 1000,
    refetchInterval: getReportRefetchInterval,
    refetchIntervalInBackground: false,
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
  return useQuery({
    queryKey: ["SAST-redirect", buildId],
    queryFn: async () => {
      const result = await observabilityService.SASTRedirect(buildId);
      return result;
    },
    enabled: !!buildId,
    retry: 2,
    staleTime: 5 * 60 * 1000,
  });
};
