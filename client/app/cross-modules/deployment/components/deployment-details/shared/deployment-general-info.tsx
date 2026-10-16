import { GitBranch } from "lucide-react";
import { formatFullDate } from "@/utils/date.util";
import { IDeploymentPageData } from "@blocks-deployment/pages/deployment-details";
import NotificationListener from "./notification-listener";
import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button/copy-to-clipboard-button";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { cn } from "@/lib/utils";
import { SURFACE_CARD_CLASS } from "./surface-styles";

// Same card and label treatment as the details grid on the repository page.
const CARD_CLASS = cn(SURFACE_CARD_CLASS, "w-full");
const LABEL_CLASS = "text-[11px] text-muted-foreground";

const LinkValue = ({ url }: { url: string }) =>
  url && url !== "N/A" ? (
    <CopyToClipboardButton textToCopy={url} isHoverable={false}>
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
    </CopyToClipboardButton>
  ) : (
    <span className="text-sm text-muted-foreground">N/A</span>
  );

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
      <section className={CARD_CLASS}>
        <div className="grid grid-cols-2 gap-x-5 gap-y-5 sm:gap-x-10 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="col-span-2 space-y-2 sm:col-span-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-40" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className={CARD_CLASS}>
        <p role="alert" className="text-sm font-medium text-danger-ink">
          Failed to load deployment information
        </p>
        <p className="mt-1 text-sm text-muted-foreground">Please try refreshing the page</p>
      </section>
    );
  }

  return (
    <section aria-label="General information" className={CARD_CLASS}>
      <dl className="grid grid-cols-2 gap-x-5 gap-y-5 sm:gap-x-10 xl:grid-cols-3">
        <div className="col-span-2 min-w-0 sm:col-span-1">
          <dt className={LABEL_CLASS}>Deploys To</dt>
          <dd className="mt-1.5 min-w-0">
            <LinkValue url={defaultDeploymentURL} />
          </dd>
        </div>
        <div className="col-span-2 min-w-0 sm:col-span-1">
          <dt className={LABEL_CLASS}>Repo URL</dt>
          <dd className="mt-1.5 min-w-0">
            <LinkValue url={selectedRepoURL} />
          </dd>
        </div>
        <div className="col-span-2 min-w-0 sm:col-span-1">
          <dt className={LABEL_CLASS}>Custom Deployment URL</dt>
          <dd className="mt-1.5 min-w-0">
            <LinkValue url={customDeploymentURL} />
          </dd>
        </div>
        <div>
          <dt className={LABEL_CLASS}>Deployment Status</dt>
          <dd className="mt-1.5">
            <NotificationListener latestBuild={latestBuild} deploymentStatus={deploymentStatus} />
          </dd>
        </div>
        <div>
          <dt className={LABEL_CLASS}>Deployment Date</dt>
          <dd className="mt-1.5 text-sm font-medium text-high-emphasis">
            {deploymentDate ? formatFullDate(new Date(deploymentDate)) : "N/A"}
          </dd>
        </div>
        <div>
          <dt className={LABEL_CLASS}>Branch</dt>
          <dd className="mt-1.5 text-sm font-medium text-high-emphasis">
            {cardData?.branch ? (
              <span className="inline-flex items-center gap-1.5 rounded-sm bg-primary/[0.07] px-2 py-1 text-xs text-primary">
                <GitBranch className="h-3 w-3" aria-hidden="true" />
                {cardData.branch}
              </span>
            ) : (
              "N/A"
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
};

export default DeploymentGeneralInfo;
