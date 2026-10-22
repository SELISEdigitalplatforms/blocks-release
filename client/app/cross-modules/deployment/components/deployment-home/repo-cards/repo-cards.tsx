import { Badge } from "@/components/ui-kits/badge/badge";

import { useNavigate } from "react-router";
import { getDeploymentLogEventBadgeClassName } from "@blocks-deployment/utils/deployment-logs.utils";
import { IDeploySettings } from "@blocks-deployment/models/deployed-logs";
import { ChevronRight, FolderGit2, GitBranch, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatFullDate } from "@/utils/date.util";
import { useScopedPath } from "@/hooks/use-scoped-path";
import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button/copy-to-clipboard-button";
import React, { useState } from "react";
import {
  useRepoAndGitBranchMatch,
  useValidateAuthorization,
} from "@/cross-modules/deployment/hooks/use-github-info";
import BranchVerificationModal from "@blocks-deployment/components/deployment-details/shared/unmatched-branch-modal";
import { DEPLOYMENT_OPTIONS_DETAILS } from "@blocks-deployment/models/deployment-settings";
import { RepositoryAccessModal } from "./repository-access-modal";

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
  /** Namespace of the live deployment. Absent means nothing is deployed - never deployed, or deleted. */
  deployedNamespace?: string | null;
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

const LABEL_CLASS = "text-[11px] text-muted-foreground";

const LinkValue = ({ url, copyable = false }: { url?: string | null; copyable?: boolean }) => {
  if (!url || url === "N/A") return <span className="text-sm text-muted-foreground">N/A</span>;
  const link = (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block truncate text-sm text-primary hover:underline"
      title={url}
      onClick={(e) => e.stopPropagation()}
    >
      {url}
    </a>
  );
  return copyable ? (
    <CopyToClipboardButton textToCopy={url} isHoverable={false}>
      {link}
    </CopyToClipboardButton>
  ) : (
    link
  );
};

export const RepoCards = ({ repo }: { repo: IRepoResponse }) => {
  const navigate = useNavigate();
  const scoped = useScopedPath();
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [skipInitialVerification, setSkipInitialVerification] = useState(false);
  const { refetch } = useRepoAndGitBranchMatch(repo.itemId, false);
  const { data: _isAuthenticated, refetch: refetchAuthorization } = useValidateAuthorization();
  const [repositoryModalOpen, setRepositoryModalOpen] = useState(false);

  const handleRepoClick = async (e: React.MouseEvent | React.KeyboardEvent) => {
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

  const handleAccessGranted = () => {
    setRepositoryModalOpen(false);
    setSkipInitialVerification(false);
    setIsLoading(true);
    setShowBranchModal(true);
  };

  const handleModalClose = () => {
    setShowBranchModal(false);
  };

  const handleSuccess = () => {
    setShowBranchModal(false);
    setIsLoading(false);
    navigate(scoped(`deployment/repo/${repo.itemId}`));
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

  const repoDisplayName = repo.repoName?.split("/").pop() || repo.repoName;
  const deploymentType =
    (repo.deploymentType &&
      DEPLOYMENT_OPTIONS_DETAILS.find(
        (option) => option.value.toLowerCase() === repo.deploymentType?.toLowerCase(),
      )?.label) ||
    "N/A";

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-busy={isLoading}
        className={cn(
          "group rounded-sm bg-card px-5 py-4 shadow-surface-ring transition-[background-color,box-shadow] hover:bg-primary/[0.03] hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-6",
          isLoading ? "pointer-events-none opacity-60" : "cursor-pointer",
        )}
        onClick={handleRepoClick}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          if (event.target !== event.currentTarget) return;
          event.preventDefault();
          handleRepoClick(event);
        }}
      >
        <header className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-primary/[0.07] text-primary">
            <FolderGit2 className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 text-base font-semibold text-high-emphasis">
              <span className="text-sm font-normal text-muted-foreground">Deploys for</span>
              <span className="min-w-0 break-words">{repoDisplayName}</span>
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {repo.branch && (
                <span className="inline-flex items-center gap-1 rounded-sm bg-primary/[0.07] px-1.5 py-0.5 font-medium text-primary">
                  <GitBranch className="h-3 w-3" aria-hidden="true" />
                  {repo.branch}
                </span>
              )}
              {isLoading && (
                <span role="status" className="inline-flex items-center gap-1.5 text-primary">
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                  {showBranchModal ? "Processing..." : "Processing in background..."}
                </span>
              )}
            </div>
          </div>
          <ChevronRight
            className="mt-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
            aria-hidden="true"
          />
        </header>

        {/* Same fields, order and label treatment as the Details tab grid. */}
        <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-4 border-t border-border-soft pt-3 sm:gap-x-10 xl:grid-cols-3">
          <div className="col-span-2 min-w-0 sm:col-span-1">
            <dt className={LABEL_CLASS}>Deploys To</dt>
            <dd className="mt-1.5 min-w-0">
              <LinkValue url={repo.defaultDeploymentUrl} copyable />
            </dd>
          </div>
          <div className="col-span-2 min-w-0 sm:col-span-1">
            <dt className={LABEL_CLASS}>Repo URL</dt>
            <dd className="mt-1.5 min-w-0">
              <LinkValue url={repo.repoUrl} />
            </dd>
          </div>
          <div className="col-span-2 min-w-0 sm:col-span-1">
            <dt className={LABEL_CLASS}>Custom Deployment URL</dt>
            <dd className="mt-1.5 min-w-0">
              <LinkValue url={repo.customDeploymentUrl} copyable />
            </dd>
          </div>
          <div>
            <dt className={LABEL_CLASS}>Deployment Status</dt>
            <dd className="mt-1.5">
              <Badge
                className={getDeploymentLogEventBadgeClassName(
                  repo.lastDeploymentStatus || "NoBuild",
                )}
              >
                {repo.lastDeploymentStatus || "No build"}
              </Badge>
            </dd>
          </div>
          <div>
            <dt className={LABEL_CLASS}>Latest Deployment Date</dt>
            <dd className="mt-1.5 text-sm font-medium text-high-emphasis">
              {repo.lastDeploymentDate ? formatFullDate(new Date(repo.lastDeploymentDate)) : "N/A"}
            </dd>
          </div>
          <div>
            <dt className={LABEL_CLASS}>Deployment Type</dt>
            <dd className="mt-1.5 text-sm font-medium text-high-emphasis">{deploymentType}</dd>
          </div>
        </dl>
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
      <RepositoryAccessModal
        isOpen={repositoryModalOpen}
        onOpenChange={setRepositoryModalOpen}
        onAuthorized={handleAccessGranted}
        refetchAuthorization={async () => {
          const result = await refetchAuthorization();
          return { data: result.data };
        }}
      />

      {/*
        Original "Connect repository" provider-picker modal — temporarily
        replaced by RepositoryAccessModal above. To restore: uncomment the
        Dialog/ProviderButtons imports at the top, the handleProviderClose
        handler, and this block; then remove the RepositoryAccessModal mount.

        <Dialog open={repositoryModalOpen} onOpenChange={setRepositoryModalOpen}>
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
              closeOnProviderSelect={true}
            />
          </DialogContent>
        </Dialog>
      */}
    </>
  );
};
