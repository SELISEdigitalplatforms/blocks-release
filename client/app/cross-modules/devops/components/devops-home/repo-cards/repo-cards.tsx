import { Badge } from "@/components/ui-kits/badge/badge";

import { useNavigate } from "react-router-dom";
import { getDeploymentLogEventBadgeClassName } from "@blocks-devops/utils/deployment-logs.utils";
import { IDeploySettings } from "@blocks-devops/models/deployed-logs";
import { ChevronRight } from "lucide-react";
import { formatFullDate } from "@/lib/utils";
import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button/copy-to-clipboard-button";
import React, { useState } from "react";
import {
  useRepoAndGitBranchMatch,
  useValidateAuthorization,
} from "@blocks-devops/hooks/github-info";
import BranchVerificationModal from "@blocks-devops/components/deployment-details/shared/unmatched-branch-modal";
import { DEPLOYMENT_OPTIONS_DETAILS } from "@blocks-devops/models/deployment-settings";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import ProviderButtons from "@blocks-devops/components/deployment-steps/render-repos/render-provider";

export interface IRepoResponse {
  sourceRepoId: string;
  sourceReference: string | null;
  blocksUserId: string | null;
  projectId: string | null;
  projectName: string | null;
  repoName: string;
  repoUrl: string;
  defaultDeploymentUrl: string;
  customDeploymentUrl: string | null;
  branch: string | null;
  commit: string | null;
  lastDeploymentDate: string | null;
  lastDeploymentStatus: string | null;
  deploySettings: IDeploySettings;
  itemId: string;
  createdDate: string;
  lastUpdatedDate: string;
  createdBy: string | null;
  language: string | null;
  lastUpdatedBy: string | null;
  organizationIds: string[];
  tags: string[];
  deploymentType: string | null;
}

export const RepoCards = ({ repo }: { repo: IRepoResponse }) => {
  const navigate = useNavigate();
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [skipInitialVerification, setSkipInitialVerification] = useState(false);
  const { refetch } = useRepoAndGitBranchMatch(repo.itemId, false);
  const { data: _isAuthenticated, refetch: refetchAuthorization } = useValidateAuthorization();
  const [repositoryModalOpen, setRepositoryModalOpen] = useState(false);

  const handleRepoClick = async (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button, a")) {
      return;
    }

    if (isLoading) {
      return;
    }

    setIsLoading(true);
    try {
      const authResult = await refetchAuthorization();
      if (authResult.data?.isSuccess) {
        setSkipInitialVerification(false);
        setShowBranchModal(true);
      } else {
        setRepositoryModalOpen(true);
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Authorization check failed:", error);
      setRepositoryModalOpen(false);
    }
  };

  const handleProviderClose = () => {
    setRepositoryModalOpen(false);
  };

  const handleModalClose = () => {
    setShowBranchModal(false);
  };

  const handleSuccess = () => {
    setShowBranchModal(false);
    setIsLoading(false);
    navigate(`/devops/repo/${repo.itemId}`);
  };

  const handleApiComplete = () => {
    setIsLoading(false);
  };

  const handleRetry = () => {
    setIsLoading(true);
    setSkipInitialVerification(false);
  };

  const handleReopenModal = () => {
    setIsLoading(false);
    setSkipInitialVerification(true);
    setShowBranchModal(true);
  };

  const handleForceShowSuccess = () => {
    setSkipInitialVerification(true);
    setShowBranchModal(true);
  };

  return (
    <>
      <div className="mb-4 space-y-2">
        <div
          className={`group flex h-auto cursor-pointer flex-col items-start justify-start gap-4 self-stretch rounded-sm border bg-background px-4 pb-2 pt-4 transition-colors sm:gap-6 sm:px-6 sm:pt-6 ${isLoading ? "pointer-events-none opacity-50" : ""
            }`}
          onClick={handleRepoClick}
        >
          {/* Header */}
          <div className="flex w-full items-center justify-start">
            <h3 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
              <span>Deploys for {repo.repoName?.split("/").pop() || repo.repoName}</span>
              {isLoading && (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-blue-600"></div>
                  <span className="text-sm font-normal text-blue-600">
                    {showBranchModal ? "Processing..." : "Processing in background..."}
                  </span>
                </>
              )}
            </h3>
            {!isLoading && (
              <ChevronRight className="ml-2 h-4 w-4 flex-shrink-0 opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
            )}
          </div>

          {/* Two-column grid */}
          <div className="mb-2 grid w-full grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
            {/* Left column */}
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-low-emphasis">Repo URL</p>
                <a
                  href={repo.repoUrl || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-sm text-blue-600 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {repo.repoUrl || "N/A"}
                </a>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-low-emphasis">Deploys To</p>
                <CopyToClipboardButton textToCopy={repo.defaultDeploymentUrl} isHoverable={false}>
                  <a
                    href={repo.defaultDeploymentUrl || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-sm text-blue-600 hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {repo.defaultDeploymentUrl ?? "N/A"}
                  </a>
                </CopyToClipboardButton>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-low-emphasis">Custom Deployment URL</p>
                {repo.customDeploymentUrl && repo.customDeploymentUrl !== "N/A" ? (
                  <CopyToClipboardButton textToCopy={repo.customDeploymentUrl} isHoverable={false}>
                    <a
                      href={repo.customDeploymentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate text-sm text-blue-600 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {repo.customDeploymentUrl}
                    </a>
                  </CopyToClipboardButton>
                ) : (
                  <span className="block truncate text-sm">{"N/A"}</span>
                )}
              </div>
            </div>

            {/* Right column */}
            <div className="mb-2 grid grid-cols-1 gap-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm text-low-emphasis">Deployment Status</p>
                  {repo.lastDeploymentStatus ? (
                    <Badge
                      className={getDeploymentLogEventBadgeClassName(repo.lastDeploymentStatus)}
                    >
                      {repo.lastDeploymentStatus}
                    </Badge>
                  ) : (
                    <Badge className={getDeploymentLogEventBadgeClassName("NoBuild")}>
                      No build
                    </Badge>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-low-emphasis">Latest Deployment Date</p>
                  <span className="text-sm">
                    {repo.lastDeploymentDate
                      ? formatFullDate(new Date(repo.lastDeploymentDate))
                      : "N/A"}
                  </span>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-low-emphasis">Deployment Type</p>
                  <span className="text-sm">
                    {(() => {
                      if (
                        repo.deploymentType == null ||
                        repo.deploymentType == undefined ||
                        repo.deploymentType == ""
                      ) {
                        return "N/A";
                      }

                      const result =
                        DEPLOYMENT_OPTIONS_DETAILS.find(
                          (option) =>
                            option.value.toLowerCase() == repo.deploymentType?.toLowerCase(),
                        )?.label || "N/A";

                      return result;
                    })()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <BranchVerificationModal
        isOpen={showBranchModal}
        onClose={handleModalClose}
        onSuccess={handleSuccess}
        onApiComplete={handleApiComplete}
        onRetry={handleRetry}
        onReopenModal={handleReopenModal}
        onForceShowSuccess={handleForceShowSuccess}
        repo={repo}
        refetch={refetch}
        isProcessing={isLoading}
        skipInitialVerification={skipInitialVerification}
      />
      <Dialog open={repositoryModalOpen} onOpenChange={setRepositoryModalOpen}>
        <DialogContent className="w-[425px] p-6">
          <DialogHeader>
            <DialogTitle>Connect repository</DialogTitle>
            <DialogDescription>
              Select a Git provider to import an existing project from a Git Repository.
            </DialogDescription>
          </DialogHeader>
          <ProviderButtons
            destination="/intermediate-page"
            onClose={handleProviderClose}
            closeOnProviderSelect={true}
          />
        </DialogContent>
      </Dialog>
    </>
  );
};
