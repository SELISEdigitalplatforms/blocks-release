import {
  IAddSingleMonitorPayload,
  ISaveHealth,
  IUpdateHealth,
  IUpdateMonitor,
} from "@blocks-devops/models/alerts";
import { alertsService } from "@blocks-devops/services/alerts.service";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const useAddSingleMonitor = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["agent-monitor"],
    mutationFn: (payload: IAddSingleMonitorPayload) => alertsService.addSingleMonitor(payload),
    onSuccess: (_data, variables) => {
      // Invalidate monitor list for the affected project so lists refresh
      queryClient.invalidateQueries({ queryKey: ["monitor-list-by-id", variables.projectKey] });
      // If editing an existing monitor, invalidate its details/analytics
      if (variables.itemId) {
        queryClient.invalidateQueries({ queryKey: ["get-monitor-details", variables.itemId] });
        queryClient.invalidateQueries({ queryKey: ["get-monitor-response-id", variables.itemId] });
        queryClient.invalidateQueries({ queryKey: ["get-monitor-by-id", variables.itemId] });
      }
    },
  });
};
export const useUpdateSingleMonitor = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["update-individual-monitor"],
    mutationFn: (payload: IUpdateMonitor) => alertsService.updateSingleMonitor(payload),
    onSuccess: (variables) => {
      queryClient.invalidateQueries({
        queryKey: ["get-monitor-details"],
      });
      queryClient.invalidateQueries({
        queryKey: ["get-monitor-response-id"],
      });
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
      // Invalidate ALL queries that start with these prefixes
       queryClient.invalidateQueries({
        queryKey: ["health-monitor-list"],
      });

      queryClient.invalidateQueries({
        queryKey: ["monitor-list-by-id"],
      });
      queryClient.invalidateQueries({
        queryKey: ["get-monitor-by-id"],
      });
    },
  });
};

export const useGetMonitorList = (projectKey: string, repoId: string) => {
  return useQuery({
    queryKey: ["monitor-list", projectKey, repoId],
    queryFn: () => alertsService.getMonitorListById(projectKey, repoId),
    refetchOnMount: "always",
  });
};
export const useGetHealthMonitorList = (
  projectKey: string,
  monitorSourceType?: number,
  pageNumber: number = 0,
  pageSize: number = 10,
) => {
  return useQuery({
    queryKey: ["health-monitor-list", projectKey, monitorSourceType, pageNumber, pageSize],
    queryFn: () =>
      alertsService.getHealthMonitorList(projectKey, monitorSourceType, pageNumber, pageSize),
    refetchOnMount: "always",
  });
};
export const useGetMonitorListById = (projectKey: string, repoId: string) => {
  return useQuery({
    queryKey: ["monitor-list-by-id", projectKey, repoId],
    queryFn: () => alertsService.getMonitorListById(projectKey, repoId),
    refetchOnMount: "always",
  });
};
export const useGetMonitorDetails = (monitorId: string) => {
  return useQuery({
    queryKey: ["get-monitor-details", monitorId],
    queryFn: () => alertsService.getMonitorDetails(monitorId),
  });
};
export const useGetMonitorById = (monitorId: string) => {
  return useQuery({
    queryKey: ["get-monitor-by-id", monitorId],
    queryFn: () => alertsService.getMonitorById(monitorId),
    enabled: !!monitorId,
  });
};
export const useGetAllIncidentList = (
  monitorId: string,
  pageNumber: number = 0,
  pageSize: number = 10,
) => {
  return useQuery({
    queryKey: ["get-all-incident-list", monitorId, pageNumber, pageSize],
    queryFn: () => alertsService.getAllMonitorIncidentList(monitorId, pageNumber, pageSize),
    enabled: !!monitorId,
    placeholderData: (previousData) => previousData,
  });
};
export const useGetMonitorResponseTime = (option: {
  monitorId: string;
  timeRange: string;
  interval: number;
}) => {
  return useQuery({
    queryKey: ["get-monitor-response-id", option.monitorId, option.timeRange],
    // queryFn: () => alertsService.GetMonitorResponseTime(monitorId),
    queryFn: async () => {
      const now = new Date();
      let startTime: Date;

      switch (option.timeRange) {
        case "1h":
          startTime = new Date(now.getTime() - 1 * 60 * 60 * 1000);
          break;
        case "24h":
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case "7d":
          startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "30d":
          startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }

      const payload = {
        monitorId: option.monitorId,
        startTime: startTime.toISOString(),
        endTime: now.toISOString(),
      };
      const res = await alertsService.GetMonitorResponseTime(payload);
      return res;
    },
    refetchInterval: (option.interval || 60) * 1000,
    enabled: !!option.monitorId && !!option.interval,
  });
};
export const useGetMonitorDownTime = (option: {
  monitorId: string;
  timeRange: string;
  interval: number;
}) => {
  return useQuery({
    queryKey: ["get-monitor-response-id", option.monitorId, option.timeRange],
    queryFn: async () => {
      const now = new Date();
      let startTime: Date;

      switch (option.timeRange) {
        case "1h":
          startTime = new Date(now.getTime() - 1 * 60 * 60 * 1000);
          break;
        case "3h":
          startTime = new Date(now.getTime() - 3 * 60 * 60 * 1000);
          break;
        case "6h":
          startTime = new Date(now.getTime() - 6 * 60 * 60 * 1000);
          break;
        case "12h":
          startTime = new Date(now.getTime() - 12 * 60 * 60 * 1000);
          break;
        case "24h":
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        default:
          startTime = new Date(now.getTime() - 1 * 60 * 60 * 1000);
      }

      const payload = {
        monitorId: option.monitorId,
        startTime: startTime.toISOString(),
        endTime: now.toISOString(),
      };
      const res = await alertsService.GetMonitorDownTime(payload);
      return res;
    },
    refetchInterval: (option.interval || 60) * 1000,
    enabled: !!option.monitorId && !!option.interval,
  });
};
export const useGetHealthById = (healthId: string) => {
  return useQuery({
    queryKey: ["get-health-by-id", healthId],
    queryFn: () => alertsService.getMonitorById(healthId),
    enabled: !!healthId,
  });
};
export const useSaveHealth = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: ["save-health"],
    mutationFn: (payload: ISaveHealth) => alertsService.saveHealth(payload),
    onSuccess: (_data, variables) => {
      // Invalidate monitor list for the affected project so lists refresh
      queryClient.invalidateQueries({ queryKey: ["monitor-list-by-id", _data.data.itemId] });
      // If editing an existing monitor, invalidate its details/analytics
      if (variables) {
        queryClient.invalidateQueries({ queryKey: ["get-monitor-details", _data.data.itemId] });
        queryClient.invalidateQueries({
          queryKey: ["get-monitor-response-id", _data.data.itemId],
        });
        queryClient.invalidateQueries({ queryKey: ["get-monitor-by-id", _data.data.itemId] });
      }
    },
  });
};
export const useUpdateHealth = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["update-health"],
    mutationFn: (payload: IUpdateHealth) => alertsService.updateHealth(payload),
    onSuccess: (variables) => {
      // Invalidate ALL queries that start with these prefixes
     
      queryClient.invalidateQueries({
        queryKey: ["get-monitor-details"],
      });
      queryClient.invalidateQueries({
        queryKey: ["get-monitor-response-id"],
      });
      queryClient.invalidateQueries({
        queryKey: ["get-health-by-id"],
      });
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
