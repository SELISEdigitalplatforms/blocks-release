import { DEPLOYMENT_LOG_EVENT_STATUS } from "@blocks-deployment/utils/deployment-logs.utils";
import LiveDeploymentLogs from "../live/live-logs-section";
import DeploymentGeneralInfo from "../shared/deployment-general-info";
import DeployedLogs from "../deployed/deployed-logs";
import { IDeploymentPageData } from "@blocks-deployment/pages/deployment-details";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";

interface DeploymentLogsTabProps {
  buildId: string;
  cardData: IDeploymentPageData | undefined;
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
}

const DeploymentLogsTab = ({
  buildId,
  cardData,
  isLoading,
  isError,
  isSuccess,
}: DeploymentLogsTabProps) => {
  return (
    <div className="flex w-full flex-col items-start gap-4">
      <DeploymentGeneralInfo
        buildId={buildId}
        cardData={cardData}
        isLoading={isLoading}
        isError={isError}
        isSuccess={isSuccess}
      />

      {isLoading ? (
        <div className="flex w-full flex-col items-start gap-4 rounded-lg border border-border bg-background p-6 shadow-sm">
          <Skeleton className="h-6 w-32" />
          <div className="w-full space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      ) : (
        <>
          {cardData?.status == DEPLOYMENT_LOG_EVENT_STATUS.STARTED ||
          cardData?.status == DEPLOYMENT_LOG_EVENT_STATUS.RUNNING ? (
            <LiveDeploymentLogs buildId={buildId} />
          ) : (
            <DeployedLogs
              buildId={buildId}
              cardData={cardData}
              isLoading={isLoading}
              isError={isError}
              isSuccess={isSuccess}
            />
          )}
        </>
      )}
    </div>
  );
};

export default DeploymentLogsTab;
