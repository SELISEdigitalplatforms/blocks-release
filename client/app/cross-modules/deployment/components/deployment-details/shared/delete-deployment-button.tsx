import { Trash2 } from "lucide-react";

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
  if (!hasLiveDeployment) {
    return null;
  }

  const confirmationData = {
    dialogTitle: "Delete deployment?",
    dialogSubtitle: (
      <>
        This permanently destroys the deployment of{" "}
        <strong>{repoName}</strong>
        {deploymentUrl ? (
          <>
            {" "}
            at <strong>{deploymentUrl}</strong>
          </>
        ) : null}
        . The site will stop responding. Build history is kept.
        <br />
        <br />
      </>
    ),
    confirmButton: "Delete",
    cancelButton: "Cancel",
  };

  return (
    <Dialog open={isModalOpen} onOpenChange={onModalOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="destructive"
          onClick={() => onModalOpenChange(true)}
          disabled={isDeleting || isDisabled}
          className="w-full shadow-sm sm:w-auto"
          data-testid="delete-deployment-button">
          <div className="flex items-center justify-center gap-2">
            <Trash2 size={20} />
            <span>{isDeleting ? "Deleting..." : "Delete"}</span>
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
