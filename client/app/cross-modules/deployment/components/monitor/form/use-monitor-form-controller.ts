import {
  useAddSingleMonitor,
  useSaveHealth,
  useUpdateHealth,
  useUpdateSingleMonitor,
} from "@/cross-modules/deployment/hooks/alerts";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { ErrorTransformer } from "@/lib/error-transform";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import {
  getMonitorFormDefaultValues,
  type MonitorFormMode,
  monitorFormSchema,
  type MonitorFormValues,
} from "./schema";
import {
  toCreateCallbackPayload,
  toCreateRequestPayload,
  toUpdateCallbackPayload,
  toUpdateRequestPayload,
} from "./util";

type UseMonitorFormControllerParams = {
  mode: MonitorFormMode;
  repoId: string;
  repoName: string;
  repoUrl: string;
  projectKey: string;
  itemId?: string;
  onSuccess?: () => void;
};

export const useMonitorFormController = ({
  mode,
  repoId,
  repoName,
  repoUrl,
  projectKey,
  onSuccess,
  itemId = "",
}: UseMonitorFormControllerParams) => {
  const navigate = useNavigate();
  const isEditMode = mode === "edit";

  const initialValues = useMemo(() => {
    return getMonitorFormDefaultValues({ repoId, repoName, repoUrl });
  }, [repoId, repoName, repoUrl]);

  const form = useForm<MonitorFormValues>({
    defaultValues: initialValues,
    values: initialValues,
    resolver: zodResolver(monitorFormSchema),
    mode: "onChange",
  });

  const monitorType = form.watch("monitorConfigurationType");

  const addMutation = useAddSingleMonitor();
  const saveHealthMutation = useSaveHealth();
  const updateRequestMutation = useUpdateSingleMonitor();
  const updateHealthMutation = useUpdateHealth();

  const isSubmitting =
    addMutation.isPending ||
    saveHealthMutation.isPending ||
    updateRequestMutation.isPending ||
    updateHealthMutation.isPending;

  const setMonitorType = (value: "request" | "callback") => {
    form.setValue("monitorConfigurationType", value, { shouldValidate: true });
  };

  const setSelectedRepoId = (value: string) => {
    form.setValue("selectedRepoId", value, { shouldValidate: true });

    if (mode !== "add") return;

    form.setValue("name", repoName, { shouldValidate: true });
    form.setValue("urlMonitor", repoUrl, { shouldValidate: true });
  };

  const submit = async (values: MonitorFormValues) => {
    const context = {
      itemId,
      projectKey,
      repoId,
      repoName,
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
    isEditMode,
    isSubmitting,
    setMonitorType,
    setSelectedRepoId,
    submit,
  };
};
