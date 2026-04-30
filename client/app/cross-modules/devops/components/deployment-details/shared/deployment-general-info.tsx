/* eslint-disable @typescript-eslint/no-explicit-any */

import { formatFullDate } from "@/lib/utils";
import { IDeploymentPageData } from "@blocks-devops/pages/deployment-details";
import NotificationListener from "./notification-listener";
import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button/copy-to-clipboard-button";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";

interface DeploymentGeneralInfoProps {
  buildId?: string;
  cardData: IDeploymentPageData | undefined;
  isLoading?: boolean;
  isError?: boolean;
  isSuccess?: boolean;
  showStatus?: boolean;
}

const DeploymentGeneralInfo = ({
  cardData,
  isLoading,
  isError,
  isSuccess,
  buildId,
  // showStatus,
}: DeploymentGeneralInfoProps) => {
  let selectedRepoURL = "";
  let deploymentStatus = "";
  let deploymentDate = "";
  let defaultDeploymentURL = "";
  let customDeploymentURL = "";

  const latestBuild = { itemId: buildId };

  if (isSuccess && cardData) {
    selectedRepoURL = cardData?.repoUrl;
    defaultDeploymentURL = cardData?.defaultDeploymentUrl || "N/A";
    customDeploymentURL = cardData?.customDeploymentUrl || "N/A";
    deploymentStatus = cardData?.status;
    deploymentDate = cardData?.createdDate;
  }

  if (isLoading) {
    return (
      <div className="flex h-auto flex-col items-start justify-center gap-6 self-stretch rounded-lg border border-border bg-background p-6 shadow-sm">
        <Skeleton className="h-6 w-48" />

        <div className="grid w-full grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-64" />
            </div>

            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-56" />
            </div>

            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-6 w-24" />
            </div>

            <div className="space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-44" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-auto flex-col items-start justify-center gap-4 self-stretch rounded-lg border border-red-200 bg-red-50 p-6 shadow-sm">
        <div className="text-red-600">
          <p className="font-medium">Failed to load deployment information</p>
          <p className="text-sm">Please try refreshing the page</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-auto flex-col items-start justify-center gap-4 self-stretch rounded-lg border bg-background p-4 shadow-sm sm:gap-6 sm:p-6">
      <h1 className="text-lg font-semibold text-high-emphasis">General information</h1>

      <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-medium-emphasis">Repo URL</p>
            <a
              href={selectedRepoURL || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-sm text-blue-600 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {"N/A"}
            </a>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-medium-emphasis">Deploys To</p>
            <CopyToClipboardButton textToCopy={defaultDeploymentURL} isHoverable={false}>
              <a
                href={defaultDeploymentURL || "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="block truncate text-sm text-blue-600 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {defaultDeploymentURL || "N/A"}
              </a>
            </CopyToClipboardButton>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-medium-emphasis">Custom Deployment URL</p>
            {customDeploymentURL && customDeploymentURL !== "N/A" ? (
              <CopyToClipboardButton textToCopy={customDeploymentURL} isHoverable={false}>
                <a
                  href={customDeploymentURL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-sm text-blue-600 hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {customDeploymentURL}
                </a>
              </CopyToClipboardButton>
            ) : (
              <span className="block truncate text-sm font-medium">{customDeploymentURL || "N/A"}</span>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-medium-emphasis">Deployment Status</p>
            <NotificationListener latestBuild={latestBuild} deploymentStatus={deploymentStatus} />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-medium-emphasis">Latest Deployment Date</p>
            <span className="text-sm font-medium">{formatFullDate(new Date(deploymentDate))}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeploymentGeneralInfo;
