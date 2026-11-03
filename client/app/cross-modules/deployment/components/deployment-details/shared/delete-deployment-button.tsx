import { Trash2 } from "lucide-react";
import { useT } from "@seliseblocks/genesis-os";

import ConfirmationModal from "@/components/confirmation-modal/confirmation-modal";
import { Button } from "@/components/ui-kits/button/button";
import { Dialog, DialogTrigger } from "@/components/ui-kits/dialog/dialog";

interface DeleteDeploymentButtonProps {
  /** Absent recorded namespace means there is nothing to delete, so the control is not offered. */
  hasLiveDeployment: boolean;
  repoName?: string;
  deploymentUrl?: string;
  isDeleting: boolean;
  isDisabled?: boolean;
  isModalOpen: boolean;
  onModalOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Destructive teardown control for a live deployment. Deleting is irreversible, so it is always
 * behind a confirmation naming the exact repository and URL that will stop responding.
 */
export const DeleteDeploymentButton = ({
  hasLiveDeployment,
  repoName,
  deploymentUrl,
  isDeleting,
  isDisabled = false,
  isModalOpen,
  onModalOpenChange,
  onConfirm,
  onCancel,
}: DeleteDeploymentButtonProps) => {
  const { t } = useT("release.deployment.details");
  if (!hasLiveDeployment) {
    return null;
  }

  const confirmationData = {
    dialogTitle: t("DELETE_DEPLOYMENT_BUTTON.DIALOG_TITLE"),
    dialogSubtitle: (
      <>
        {deploymentUrl
          ? t("DELETE_DEPLOYMENT_BUTTON.SUBTITLE_WITH_URL", {
              repoName: repoName ?? "",
              url: deploymentUrl,
            })
          : t("DELETE_DEPLOYMENT_BUTTON.SUBTITLE", {
              repoName: repoName ?? "",
            })}
        <br />
        <br />
      </>
    ),
    confirmButton: t("common:DELETE"),
    cancelButton: t("common:CANCEL"),
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={onModalOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="destructive"
          onClick={() => onModalOpenChange(true)}
          disabled={isDeleting || isDisabled}
          className="w-full shadow-xs sm:w-auto"
          data-testid="delete-deployment-button">
          <div className="flex items-center justify-center gap-2">
            <Trash2 size={20} />
            <span>{isDeleting
                ? t("DELETE_DEPLOYMENT_BUTTON.DELETING")
                : t("common:DELETE")}</span>
          </div>
        </Button>
      </DialogTrigger>
      <ConfirmationModal
        data={confirmationData}
        onCancel={onCancel}
        onConfirm={onConfirm}
        buttonState={{ confirm: { disable: isDeleting } }}
      />
    </Dialog>
  );
};

export default DeleteDeploymentButton;
