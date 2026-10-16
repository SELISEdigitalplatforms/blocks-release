import { useQuery } from "@tanstack/react-query";
import { useProjectStore } from "@/store/project.store";
import { getDeploymentActivity } from "../services/deployment-activity.service";

export const useDeploymentActivity = (repoId: string, branch: string, endDate: string) => {
  const projectKey = useProjectStore((state) => state.selectedProject?.tenantId || "");
  return useQuery({
    // The repo-details prefix also lets deploy/delete mutations refresh the calendar.
    queryKey: ["repo-details", repoId, projectKey, "activity", branch, endDate],
    queryFn: ({ signal }) => getDeploymentActivity(repoId, branch, endDate, signal),
    enabled: Boolean(repoId && branch && projectKey),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
};
