import React from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import { Badge } from "@/components/ui-kits/badge/badge";
import { useNavigate } from "react-router-dom";
import {
  getDeploymentLogEventBadgeClassName,
  getTimeDifference,
} from "@blocks-deployment/utils/deployment-logs.utils";
import { IPipeline } from "@blocks-deployment/pages/repo-details";
import NotificationListener from "./notification-listener";
import { cn } from "@/lib/utils";
import { formatFullDate } from "@/utils/date.util";
import SASTLogo from "@blocks-deployment/assets/icons/SAST.svg";
import SCALogo from "@blocks-deployment/assets/icons/SCA.svg";
import DASTLogo from "@blocks-deployment/assets/icons/DAST.png";

interface DeploymentObservabilityProps {
  builds: IPipeline[];
  showAllHistory?: boolean;
  viewLatestBuild?: boolean;
}

const DeploymentObservability = ({
  builds,
  showAllHistory = false,
  viewLatestBuild = false,
}: DeploymentObservabilityProps) => {
  const navigate = useNavigate();
  const actions = ["SAST", "SCA", "DAST"];
  const latestBuild = builds?.reduce((latest, current) => {
    if (!latest) return current;
    return new Date(current.createdDate) > new Date(latest.createdDate)
      ? current
      : latest;
  }, builds[0]);
  const latestBuildStatus = latestBuild?.status;
  const handleActionClick = (
    action: string,
    repoId: string,
    buildId: string,
    event: React.MouseEvent,
  ) => {
    event.stopPropagation();
    navigate(
      `/deployment/repo/${repoId}/deployment-logs/${buildId}?tab=${action.toLowerCase()}`,
    );
  };

  const handleDeployedItem = (repoId: string, buildId: string) => {
    navigate(
      `/deployment/repo/${repoId}/deployment-logs/${buildId}?tab=deployment-logs`,
    );
  };

  const sortedBuilds = [...(builds || [])].sort(
    (a, b) =>
      new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime(),
  );

  const displayedBuilds = showAllHistory
    ? sortedBuilds
    : sortedBuilds.slice(0, 3);

  const renderActionIcon = (action: string) => {
    switch (action) {
      case "SAST":
        return (
          <img
            src={SASTLogo}
            width={16}
            height={16}
            alt="SAST logo"
            className="mr-2 h-4 w-4"
          />
        );
      case "SCA":
        return (
          <img
            src={SCALogo}
            width={16}
            height={16}
            alt="SCA logo"
            className="mr-2 h-4 w-4"
          />
        );
      case "DAST":
        return (
          <img
            src={DASTLogo}
            width={12}
            height={12}
            alt="DAST logo"
            className="mr-2 h-3 w-3"
          />
        );
      default:
        return null;
    }
  };
  if (viewLatestBuild) {
    const latestBuildOnly = latestBuild ? [latestBuild] : [];
    return (
      <div className="w-full rounded-sm bg-background">
        <div className="divide-y divide-border-default">
          {latestBuildOnly.map((build) => (
            <div
              key={build.itemId + 1}
              className="flex flex-col gap-3 px-1 py-4 hover:cursor-pointer hover:bg-secondary sm:flex-row sm:items-center sm:justify-between sm:gap-0"
              onClick={() => handleDeployedItem(build.repoId, build.itemId)}>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-high-emphasis">
                    <div className="flex flex-wrap items-center gap-2 pb-2">
                      <span className="text-sm font-medium">
                        {build.eventName}
                      </span>
                      <NotificationListener
                        latestBuild={latestBuild}
                        deploymentStatus={latestBuildStatus}
                      />
                    </div>
                    <span className="text-xs text-medium-emphasis sm:text-sm">
                      ID: {build.itemId}
                    </span>
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {actions.map((action) => (
                    <button
                      key={action}
                      className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1.5 text-xs font-medium hover:border-gray-400 hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 sm:px-3 sm:py-2 sm:text-sm"
                      onClick={(event) =>
                        handleActionClick(
                          action,
                          build.repoId,
                          build.itemId,
                          event,
                        )
                      }>
                      {renderActionIcon(action)} <span>{action}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 sm:gap-4">
                <div className="text-left sm:text-right">
                  <div className="text-xs font-medium sm:text-sm">
                    {formatFullDate(new Date(build.createdDate))}
                  </div>
                  <div className="text-xs text-gray-600">
                    Deployed in{" "}
                    {getTimeDifference(
                      build.createdDate,
                      build.lastUpdatedDate,
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="p-1"
                  onClick={() =>
                    handleDeployedItem(build.repoId, build.itemId)
                  }>
                  <ChevronRight className="h-4 w-4 text-gray-900" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-sm bg-background">
      <div className="divide-emphasis-low divide-y">
        {displayedBuilds.map((build) => (
          <div
            key={build.itemId + 1}
            className="flex flex-col gap-3 px-1 py-4 hover:cursor-pointer hover:bg-secondary sm:flex-row sm:items-center sm:justify-between sm:gap-0"
            onClick={() => handleDeployedItem(build.repoId, build.itemId)}>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">
                  <div className="flex flex-wrap items-center gap-2 pb-2">
                    <span className="text-sm font-medium">
                      {build.eventName}
                    </span>
                    {latestBuild?.itemId === build.itemId ? (
                      <NotificationListener
                        latestBuild={latestBuild}
                        deploymentStatus={latestBuildStatus}
                      />
                    ) : (
                      <Badge
                        className={getDeploymentLogEventBadgeClassName(
                          build.status,
                        )}>
                        {build.status}
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs sm:text-sm">ID: {build.itemId}</span>
                </span>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {actions.map((action) => (
                  <button
                    key={action}
                    className="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1.5 text-xs font-medium hover:border-gray-400 hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 sm:px-3 sm:py-2 sm:text-sm"
                    onClick={(event) =>
                      handleActionClick(
                        action,
                        build.repoId,
                        build.itemId,
                        event,
                      )
                    }>
                    {renderActionIcon(action)} <span>{action}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 sm:gap-4">
              <div className="text-left sm:text-right">
                <div className="text-xs font-medium sm:text-sm">
                  {formatFullDate(new Date(build.createdDate))}
                </div>
                <div className="text-xs text-gray-600">
                  Deployed in{" "}
                  {getTimeDifference(build.createdDate, build.lastUpdatedDate)}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="p-1"
                onClick={() => handleDeployedItem(build.repoId, build.itemId)}>
                <ChevronRight className="h-4 w-4 text-gray-900" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      <div className="border-default mt-2 border-t px-4 py-3 text-xs text-medium-emphasis">
        Showing 1-{displayedBuilds.length} of {sortedBuilds.length} deploys
      </div>
    </div>
  );
};

export default DeploymentObservability;
