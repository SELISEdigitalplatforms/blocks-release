import { useProjectStore } from "@/store/useProjectStore";
import { MonitorFormFields } from "./monitor-form-fields";
import { useMonitorFormController } from "./use-monitor-form-controller";

type Props = {
  itemId?: string | null;
  onSuccess?: () => void;
};

export function AddSingleMonitorForm({ itemId: _itemId, onSuccess }: Props) {
  const projectKey = useProjectStore().selectedProject?.tenantId || "";

  const controller = useMonitorFormController({
    mode: "add",
    projectKey,
    onSuccess,
  });

  return (
    <MonitorFormFields
      form={controller.form}
      mode="add"
      onSubmit={controller.form.handleSubmit(controller.submit)}
      monitorType={controller.monitorType}
      sourceType={controller.sourceType}
      deployedRepos={controller.deployedRepos}
      services={controller.services}
      isLoadingRepos={controller.isLoadingRepos}
      isLoadingServices={controller.isLoadingServices}
      isSubmitting={controller.isSubmitting}
      isEditMode={controller.isEditMode}
      sourceError={controller.sourceError}
      isSourceBlocked={controller.isSourceBlocked}
      onMonitorTypeChange={controller.setMonitorType}
      onSourceTypeChange={controller.setSourceType}
      onRepoChange={controller.setSelectedRepoId}
      onServiceChange={controller.setSelectedServiceId}
    />
  );
}
