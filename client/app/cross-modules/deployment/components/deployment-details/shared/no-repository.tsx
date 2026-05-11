import { RepositorySelectionModal } from "@/components/repo-selection-modal/repository-selection-modal";
import { Button } from "@/components/ui-kits/button/button";
import { Card } from "@/components/ui-kits/card/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { useValidateAuthorization } from "@/cross-modules/deployment/hooks/github-info";
import { IRepository } from "@/cross-modules/deployment/models/github-info";
import { useAddAssets } from "@/cross-modules/identifier/hooks/use-project";
import { useBoolean } from "@/hooks/use-boolean";
import { toast } from "@/hooks/use-toast";
import { useProjectStore } from "@/store/useProjectStore";
import { GitBranch, Plus } from "lucide-react";
import ProviderButtons from "../../deployment-steps/render-repos/render-provider";

export const NoRepositoryAvailable = () => {
  const tenantId = useProjectStore().selectedTenantGroup;

  const { data: isAuthenticated } = useValidateAuthorization();
  const { mutateAsync } = useAddAssets();

  const {
    value: isVersionControlProviderModalOpen,
    setFalse: setVersionControlProviderModalFalse,
    setTrue: setVersionControlProviderModalTrue,
    setValue: setVersionControlProviderModalValue,
  } = useBoolean(false);
  const {
    value: isRepoSelectionModalOpen,
    setFalse: setSelectRepositoryModalFalse,
    setTrue: setSelectRepositoryModalTrue,
    setValue: setSelectRepositoryModalValue,
  } = useBoolean(false);

  const handleAddRepositoryClick = async () => {
    try {
      if (isAuthenticated?.isSuccess) {
        setSelectRepositoryModalTrue();
      } else {
        setVersionControlProviderModalTrue();
      }
    } catch (error) {
      toast({
        title: `Authorization check failed`,
        description: `${error}`,
        variant: "destructive",
      });
      setVersionControlProviderModalTrue();
    }
  };

  const handleProviderClose = (verifyAuth: boolean) => {
    setVersionControlProviderModalFalse();
    if (verifyAuth) setSelectRepositoryModalValue(verifyAuth);
  };

  const onAddRepo = async (repo: IRepository) => {
    try {
      setSelectRepositoryModalFalse();
      await mutateAsync({
        tenantGroupId: tenantId ?? "",
        resource: {
          resourceId: String(repo.id),
          name: repo.full_name,
          link: repo.html_url,
        },
      });

      toast({
        title: "Success",
        description: "Repository added successfully",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
      setSelectRepositoryModalFalse();
    }
  };

  return (
    <>
      <Card>
        <div className="flex h-auto flex-col items-center justify-center self-stretch rounded-sm bg-background px-1 py-5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
            <GitBranch className="h-8 w-8 text-low-emphasis" />
          </div>
          <div className="flex flex-col items-center gap-2">
            <h3 className="py-4 text-xl font-semibold text-high-emphasis">
              No repository added
            </h3>

            <p className="max-w-md items-center text-center text-sm text-medium-emphasis">
              To view deployment activity, please add at least one repository to
              your project
            </p>
          </div>
          <Button
            onClick={handleAddRepositoryClick}
            size={"sm"}
            className="mt-6">
            <Plus size={16} /> Add repository
          </Button>
        </div>
      </Card>

      <Dialog
        open={isVersionControlProviderModalOpen}
        onOpenChange={(val) => setVersionControlProviderModalValue(val)}>
        <DialogContent className="w-[425px] p-6">
          <DialogHeader>
            <DialogTitle>Connect repository</DialogTitle>
            <DialogDescription>
              Select a Git provider to import an existing project from a Git
              Repository.
            </DialogDescription>
          </DialogHeader>
          <ProviderButtons
            destination="/intermediate-page"
            onClose={handleProviderClose}
          />
        </DialogContent>
      </Dialog>

      <RepositorySelectionModal
        open={isRepoSelectionModalOpen}
        onOpenChange={(val) => setSelectRepositoryModalValue(val)}
        onSelectRepository={onAddRepo}
        title="Select repository"
        description="Select the repositories you want to link to this project"
      />
    </>
  );
};
