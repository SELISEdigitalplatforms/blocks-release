import {
  useAddSingleMonitor,
  useGetMonitorById,
  useGetMonitorListById,
  useIsExternalServiceConfigured,
  useSaveHealth,
  useUpdateHealth,
  useUpdateSingleMonitor,
} from "@/cross-modules/deployment/hooks/alerts";
import {
  toCreateCallbackPayload,
  toCreateRequestPayload,
  toFormValuesFromMonitorDetails,
  toUpdateCallbackPayload,
  toUpdateRequestPayload,
} from "./util";
import { ErrorTransformer } from "@/lib/error-transform";
import { useGetAllServices } from "@/cross-modules/identifier/hooks/use-services";
import { useGetEnvRepositories } from "@/cross-modules/identifier/hooks/use-project";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import {
  getMonitorFormDefaultValues,
  type MonitorFormMode,
  monitorFormSchema,
  type MonitorFormValues,
  type SourceType,
} from "./schema";

type RepoOption = {
  itemId: string;
  repoName: string;
  customDeploymentUrl?: string | null;
  defaultDeploymentUrl?: string | null;
  repoUrl?: string | null;
};

type ServiceOption = {
  serviceId: string;
  name: string;
  url?: string | null;
};

type UseMonitorFormControllerParams = {
  mode: MonitorFormMode;
  itemId?: string | null;
  projectKey: string;
  onSuccess?: () => void;
};

export const useMonitorFormController = ({
  mode,
  itemId,
  projectKey,
  onSuccess,
}: UseMonitorFormControllerParams) => {
  const navigate = useNavigate();
  const isEditMode = mode === "edit";

  const { data: monitorDetails } = useGetMonitorById(itemId || "");

  const initialValues = useMemo(() => {
    if (isEditMode) {
      return toFormValuesFromMonitorDetails(monitorDetails?.data);
    }

    return getMonitorFormDefaultValues();
  }, [isEditMode, monitorDetails?.data]);

  const form = useForm<MonitorFormValues>({
    defaultValues: getMonitorFormDefaultValues(),
    values: initialValues,
    resolver: zodResolver(monitorFormSchema),
    mode: "onChange",
  });

  const monitorType = form.watch("monitorConfigurationType");
  const sourceType = form.watch("sourceType");
  const selectedRepoId = form.watch("selectedRepoId");
  const selectedServiceId = form.watch("selectedServiceId");

  const { data: envRepositoriesResponse, isLoading: isLoadingRepos } =
    useGetEnvRepositories(projectKey);

  const { data: servicesResponse, isLoading: isLoadingServices } =
    useGetAllServices({
      projectKey,
      page: 0,
      pageSize: 100,
    });

  const deployedRepos = useMemo<RepoOption[]>(
    () => (envRepositoriesResponse?.data as RepoOption[]) ?? [],
    [envRepositoriesResponse],
  );

  const services = useMemo<ServiceOption[]>(
    () => (servicesResponse?.data as ServiceOption[]) ?? [],
    [servicesResponse],
  );

  const selectedRepo = useMemo(
    () => deployedRepos.find((repo) => repo.itemId === selectedRepoId),
    [deployedRepos, selectedRepoId],
  );

  const selectedService = useMemo(
    () => services.find((service) => service.serviceId === selectedServiceId),
    [services, selectedServiceId],
  );

  const { data: repoMonitorList } = useGetMonitorListById(
    projectKey,
    selectedRepoId,
    Boolean(selectedRepoId),
  );

  const { data: externalServiceConfig } =
    useIsExternalServiceConfigured(selectedServiceId);

  const repoDuplicate = useMemo(() => {
    if (isEditMode || sourceType !== "deployed" || !selectedRepoId)
      return false;
    const monitors = repoMonitorList?.data || [];
    return monitors.some((monitor) => monitor.itemId !== itemId);
  }, [isEditMode, sourceType, selectedRepoId, repoMonitorList, itemId]);

  const externalConfiguredItemId =
    (externalServiceConfig?.data as { itemId?: string } | null)?.itemId || "";

  const serviceDuplicate =
    !isEditMode &&
    sourceType === "my-services" &&
    Boolean(selectedServiceId) &&
    Boolean(externalConfiguredItemId);

  const sourceError = useMemo(() => {
    if (sourceType === "deployed" && !selectedRepoId) {
      return isLoadingRepos ? "Loading repos..." : "Select a deployed repo.";
    }

    if (sourceType === "my-services" && !selectedServiceId) {
      return isLoadingServices ? "Loading services..." : "Select a service.";
    }

    if (repoDuplicate) {
      return "A monitor already exists for this deployed repo.";
    }

    if (serviceDuplicate) {
      return "A monitor already exists for this service.";
    }

    return "";
  }, [
    sourceType,
    selectedRepoId,
    selectedServiceId,
    isLoadingRepos,
    isLoadingServices,
    repoDuplicate,
    serviceDuplicate,
  ]);

  const isSourceBlocked = Boolean(sourceError);

  const addMutation = useAddSingleMonitor();
  const saveHealthMutation = useSaveHealth();
  const updateRequestMutation = useUpdateSingleMonitor();
  const updateHealthMutation = useUpdateHealth();

  const isSubmitting =
    addMutation.isPending ||
    saveHealthMutation.isPending ||
    updateRequestMutation.isPending ||
    updateHealthMutation.isPending;

  const setSourceType = (value: SourceType) => {
    form.setValue("sourceType", value, { shouldValidate: true });

    if (value === "deployed") {
      form.setValue("selectedServiceId", "", { shouldValidate: true });
      return;
    }

    if (value === "my-services") {
      form.setValue("selectedRepoId", "", { shouldValidate: true });
      return;
    }

    form.setValue("selectedRepoId", "", { shouldValidate: true });
    form.setValue("selectedServiceId", "", { shouldValidate: true });
  };

  const setMonitorType = (value: "request" | "callback") => {
    form.setValue("monitorConfigurationType", value, { shouldValidate: true });
  };

  const setSelectedRepoId = (value: string) => {
    form.setValue("selectedRepoId", value, { shouldValidate: true });
    form.setValue("selectedServiceId", "", { shouldValidate: true });

    if (mode !== "add") return;

    const repo = deployedRepos.find((item) => item.itemId === value);
    if (!repo) return;

    const prefillUrl =
      repo.customDeploymentUrl ||
      repo.defaultDeploymentUrl ||
      repo.repoUrl ||
      "";

    form.setValue("name", repo.repoName || "", { shouldValidate: true });
    form.setValue("urlMonitor", prefillUrl || "", { shouldValidate: true });
  };

  const setSelectedServiceId = (value: string) => {
    form.setValue("selectedServiceId", value, { shouldValidate: true });
    form.setValue("selectedRepoId", "", { shouldValidate: true });

    if (mode !== "add") return;

    const service = services.find((item) => item.serviceId === value);
    if (!service) return;

    form.setValue("name", service.name || "", { shouldValidate: true });
    form.setValue("urlMonitor", service.url || "", { shouldValidate: true });
  };

  const submit = async (values: MonitorFormValues) => {
    if (isSourceBlocked) return;

    const fallbackRepoName = monitorDetails?.data?.repoName || "";
    const fallbackExternalServiceName =
      monitorDetails?.data?.externalServiceName || "";

    const context = {
      itemId: itemId || "",
      projectKey,
      repoName: selectedRepo?.repoName || fallbackRepoName,
      externalServiceName:
        selectedService?.name || fallbackExternalServiceName || "",
    };

    try {
      if (values.monitorConfigurationType === "request") {
        const res =
          mode === "add"
            ? await addMutation.mutateAsync(
                toCreateRequestPayload(values, context),
              )
            : await updateRequestMutation.mutateAsync(
                toUpdateRequestPayload(values, context),
              );

        if (!res.isSuccess) {
          return showErrorToast({ errors: res.message });
        }

        if (mode === "add") {
          navigate(`/health/monitor/${res?.data?.itemId}`);
        }
      } else {
        const res =
          mode === "add"
            ? await saveHealthMutation.mutateAsync(
                toCreateCallbackPayload(values, context),
              )
            : await updateHealthMutation.mutateAsync(
                toUpdateCallbackPayload(values, context),
              );

        if (!res.isSuccess) {
          return showErrorToast({ errors: res.message });
        }

        if (mode === "add") {
          navigate(`/health/monitor/${res?.data?.itemId}`);
        }
      }

      showSuccessToast({
        description:
          mode === "add"
            ? "Monitor successfully created."
            : "Monitor successfully updated.",
      });

      onSuccess?.();
    } catch (error) {
      return showErrorToast({ errors: ErrorTransformer(error) });
    }
  };

  return {
    form,
    monitorType,
    sourceType,
    deployedRepos,
    services,
    isLoadingRepos,
    isLoadingServices,
    isEditMode,
    isSubmitting,
    sourceError,
    isSourceBlocked,
    setMonitorType,
    setSourceType,
    setSelectedRepoId,
    setSelectedServiceId,
    submit,
  };
};
