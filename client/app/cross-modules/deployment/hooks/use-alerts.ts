import type {
  IUpdateHealth,
  IUpdateSingleMonitorPayload,
} from "@/cross-modules/deployment/models/alerts.model";
import { alertsService } from "@blocks-deployment/services/alerts.service";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const useUpdateSingleMonitor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["update-individual-monitor"],
    mutationFn: (payload: Partial<IUpdateSingleMonitorPayload>) =>
      alertsService.updateSingleMonitor(payload),
    onSuccess: (variables) => {
      queryClient.invalidateQueries({
        queryKey: ["monitor-list-by-id"],
      });

      queryClient.refetchQueries({
        queryKey: ["get-monitor-by-id", variables.data.itemId],
      });
    },
  });
};

export const useDeleteMonitor = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["delete-monitor"],
    mutationFn: (itemId: string) => alertsService.deleteSingleMonitor(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["monitor-list-by-id"],
      });
      queryClient.invalidateQueries({
        queryKey: ["get-monitor-by-id"],
      });
    },
  });
};

export const useGetMonitorListById = (projectKey: string, repoId: string) => {
  return useQuery({
    queryKey: ["monitor-list-by-id", projectKey, repoId],
    queryFn: () => alertsService.getMonitorListById(projectKey, repoId),
    refetchOnMount: "always",
    enabled: !!projectKey && !!repoId,
  });
};

export const useUpdateHealth = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["update-health"],
    mutationFn: (payload: Partial<IUpdateHealth>) =>
      alertsService.updateHealth(payload),
    onSuccess: (variables) => {
      queryClient.invalidateQueries({
        queryKey: ["monitor-list-by-id"],
      });

      // Also try refetching specific queries
      queryClient.refetchQueries({
        queryKey: ["get-monitor-by-id", variables.data.tenantId],
      });
    },
  });
};

export const useDeleteHealth = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["delete-health"],
    mutationFn: (itemId: string) => alertsService.deleteHealth(itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["monitor-list-by-id"],
      });
      queryClient.invalidateQueries({
        queryKey: ["get-monitor-by-id"],
      });
    },
  });
};
