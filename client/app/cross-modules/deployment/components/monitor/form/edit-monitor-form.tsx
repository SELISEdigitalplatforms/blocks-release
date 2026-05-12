import { useProjectStore } from "@/store/useProjectStore";
import { MonitorFormFields } from "./monitor-form-fields";
import { useMonitorFormController } from "./use-monitor-form-controller";

type Props = {
  itemId: string;
  repoId: string;
  repoName: string;
  repoUrl: string;
  onSuccess?: () => void;
};

export function EditSingleMonitorForm({
  itemId,
  repoId,
  repoName,
  repoUrl,
  onSuccess,
}: Props) {
  const projectKey = useProjectStore().selectedProject?.tenantId || "";

  const controller = useMonitorFormController({
    mode: "edit",
    itemId,
    projectKey,
    repoId,
    repoName,
    repoUrl,
    onSuccess,
  });

  return (
    <MonitorFormFields
      form={controller.form}
      mode="edit"
      onSubmit={controller.form.handleSubmit(controller.submit)}
      monitorType={controller.monitorType}
      isSubmitting={controller.isSubmitting}
      isEditMode={controller.isEditMode}
      onMonitorTypeChange={controller.setMonitorType}
    />
  );
}
