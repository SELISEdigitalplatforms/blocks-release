import { EllipsisVertical } from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui-kits/dropdown-menu/dropdown-menu";
import { Button } from "@/components/ui-kits/button/button";
import {
  useDeleteHealth,
  useDeleteMonitor,
  useUpdateHealth,
  useUpdateSingleMonitor,
} from "@blocks-devops/hooks/alerts";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

type AlertActionProps = {
  monitorId: string;
  isActive: boolean;
  goBack?: boolean;
  name: string;
  request: boolean;
  projectKey: string;
  monitorSourceType?: number;
};

const AlertAction = ({
  monitorId,
  isActive,
  goBack,
  name,
  request,
  projectKey,
  monitorSourceType,
}: AlertActionProps) => {
  const activityState = isActive ? "Pause" : "Resume";
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState<boolean>(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState<boolean>(false);

  return (
    <>
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <EllipsisVertical className="h-5 w-5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="gap-2"
              onClick={(e) => {
                e.stopPropagation();
                setIsUpdateDialogOpen(true);
              }}
            >
              <span>{activityState}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2"
              onClick={(e) => {
                e.stopPropagation();
                setIsDeleteDialogOpen(true);
              }}
            >
              <span>Delete</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {isUpdateDialogOpen && (
        <UpdateMonitorDialog
          monitorId={monitorId}
          isActive={isActive}
          activityState={activityState}
          isOpen={isUpdateDialogOpen}
          onOpenChange={setIsUpdateDialogOpen}
          name={name}
          request={request}
          projectKey={projectKey}
          monitorSourceType={monitorSourceType}
        />
      )}

      {isDeleteDialogOpen && (
        <DeleteMonitorDialog
          monitorId={monitorId}
          isOpen={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
          goBack={goBack}
          request={request}
        />
      )}
    </>
  );
};

export default AlertAction;

type UpdateMonitorDialogProps = {
  monitorId: string;
  isActive: boolean;
  activityState: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  request: boolean;
  projectKey: string;
  monitorSourceType?: number;
};

const UpdateMonitorDialog = ({
  monitorId,
  isActive,
  activityState,
  isOpen,
  onOpenChange,
  request,
  name,
  projectKey,
  monitorSourceType,
}: UpdateMonitorDialogProps) => {
  const updateMutation = useUpdateSingleMonitor();
  const updateHealth = useUpdateHealth();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  const handleUpdate = async () => {
    setIsLoading(true);
    try {
      if (request) {
        await updateMutation.mutateAsync({
          itemId: monitorId,
          isActive: !isActive,
        });
      } else {
        await updateHealth.mutateAsync({
          itemId: monitorId,
          isActive: !isActive,
          name,
          projectKey,
        });
      }

      await queryClient.invalidateQueries({ queryKey: ["health-monitor-list"] });
      await queryClient.invalidateQueries({ queryKey: ["monitor-list-by-id"] });
      await queryClient.invalidateQueries({ queryKey: ["get-monitor-by-id", monitorId] });

      toast({
        variant: "success",
        title: "Success",
        description: isActive ? "Monitor paused successfully" : "Monitor resumed successfully",
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Failed to update monitor:", error);
      toast({
        variant: "destructive",
        title: "Failed",
        description: "Failed to update monitor status",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{activityState} monitor?</DialogTitle>
          <DialogDescription>
            {isActive
              ? "This will temporarily stop all checks for this monitor until resumed."
              : "Checks will start running again based on the configured interval."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" disabled={isLoading} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleUpdate} disabled={isLoading}>
            {isLoading ? "Updating..." : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

type DeleteMonitorDialogProps = {
  monitorId: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  goBack?: boolean;
  request: boolean;
};

const DeleteMonitorDialog = ({
  monitorId,
  isOpen,
  onOpenChange,
  goBack = true,
  request,
}: DeleteMonitorDialogProps) => {
  const navigate = useNavigate();
  // Only call the hook when the dialog is open
  const deleteMutation = useDeleteMonitor();
  const deleteHealth = useDeleteHealth();

  const handleDelete = async () => {
    try {
      if (request) {
        await deleteMutation.mutateAsync(monitorId);
      } else {
        await deleteHealth.mutateAsync(monitorId);
      }
      onOpenChange(false);
      if (goBack) {
        navigate(-1);
      }
    } catch (error) {
      console.error("Failed to delete monitor:", error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove monitor?</DialogTitle>
          <DialogDescription>
            This action will permanently delete the monitor and its related history. This cannot be
            undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            disabled={deleteMutation.isPending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
