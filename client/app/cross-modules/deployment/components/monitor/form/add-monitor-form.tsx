import { useProjectStore } from "@/store/useProjectStore";
import { MonitorFormFields } from "./monitor-form-fields";
import { useMonitorFormController } from "./use-monitor-form-controller";

type Props = {
  repoId: string;
  repoName: string;
  repoUrl: string;
  onSuccess?: () => void;
};

export function AddSingleMonitorForm({
  repoId,
  repoName,
  repoUrl,
  onSuccess,
}: Props) {
  const projectKey = useProjectStore().selectedProject?.tenantId || "";

  const controller = useMonitorFormController({
    mode: "add",
    repoId,
    repoName,
    repoUrl,
    projectKey,
    onSuccess,
  });

  return (
    <MonitorFormFields
      form={controller.form}
      mode="add"
      onSubmit={controller.form.handleSubmit(controller.submit)}
      monitorType={controller.monitorType}
      isSubmitting={controller.isSubmitting}
      isEditMode={controller.isEditMode}
      onMonitorTypeChange={controller.setMonitorType}
    />
  );
}
