import React, { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import { useNavigate } from "react-router";
import {
  getBuildDurationLabel,
  isLiveBuildStatus,
} from "@blocks-deployment/utils/deployment-logs.utils";
import { IPipeline } from "@blocks-deployment/pages/repo-details";
import {
  DeploymentStatusBadge,
  useDeploymentStatus,
} from "./notification-listener";
import { formatFullDate } from "@/utils/date.util";
import { useScopedPath } from "@/hooks/use-scoped-path";
import { useTickingNow } from "@/hooks/use-ticking-now";
import SASTLogo from "@blocks-deployment/assets/icons/SAST.svg";
import SCALogo from "@blocks-deployment/assets/icons/SCA.svg";
import DASTLogo from "@blocks-deployment/assets/icons/DAST.png";

interface DeploymentObservabilityProps {
  builds: IPipeline[];
  viewLatestBuild?: boolean;
  /**
   * 1-based position of the first build in `builds` within the whole history. The caller
   * pages on the server, so the component cannot work this out from `builds` alone.
   */
  startIndex?: number;
  /** Total builds across every page. Defaults to what was handed in when unpaged. */
  totalCount?: number;
  /**
   * When the builds in hand were fetched, as react-query's `dataUpdatedAt`. The running
   * timer counts wall time from this instant, so it stays right for data served from
   * cache - a row reached again within the query's stale time is minutes old, and a
   * timer anchored to mount would restart from wherever that stale record left off.
   */
  dataUpdatedAt?: number;
}

interface BuildDurationProps {
  build: IPipeline;
  /**
   * The row's status, live where the row has a live one. The wording is driven by the
   * same value as the badge beside it so the two can never disagree.
   */
  status: string;
  dataUpdatedAt?: number;
}

/**
 * The line beneath a build's date: how long it has been running, or how long it took.
 *
 * The number is built from the response's own two stamps plus wall time since the
 * response landed, never from the browser's clock against a server timestamp. The two
 * stamps sit on the same server clock, so their difference is exact, and measuring only
 * the part after the fetch keeps a browser clock that disagrees with the server's out
 * of the answer.
 */
const BuildDuration = ({ build, status, dataUpdatedAt }: BuildDurationProps) => {
  const measuredMs =
    new Date(build.lastUpdatedDate).getTime() -
    new Date(build.createdDate).getTime();

  const isRunning = isLiveBuildStatus(status);

  // Only used where the caller supplies no fetch time - the ticker still needs
  // something to count from, and mount is the closest instant available. Held in state
  // rather than a ref because it is read while rendering.
  const [mountedAtMs] = useState<number>(() => Date.now());
  const anchorMs = dataUpdatedAt ?? mountedAtMs;

  const now = useTickingNow(isRunning);
  const liveMs = measuredMs + Math.max(0, now - anchorMs);

  // A build that finishes between polls leaves a stale `lastUpdatedDate` behind: the
  // record still says what it said at the last write. That is exactly how a deployment
  // three minutes into its run came to report "Deployed in 16s". Hold the elapsed the
  // ticker had reached until a refetch brings the real one.
  const [frozenMs, setFrozenMs] = useState<number | null>(null);
  const wasRunningRef = useRef(false);

  useEffect(() => {
    if (isRunning) {
      wasRunningRef.current = true;
      return;
    }
    // Rows already finished when they first rendered have nothing to hold. Their
    // `lastUpdatedDate` IS the finish time, and freezing here would add however long a
    // cached response had been sitting around to a duration that is already final.
    if (!wasRunningRef.current) return;
    setFrozenMs((held) => held ?? liveMs);
  }, [isRunning, liveMs]);

  // Once finished, the server's own measurement is the authority - but only once it has
  // actually arrived. Taking the larger of the two picks the held value while the record
  // is still stale, the server's the moment it catches up, and never moves backwards.
  const elapsedMs = isRunning ? liveMs : Math.max(measuredMs, frozenMs ?? 0);

  return <>{getBuildDurationLabel(status, elapsedMs)}</>;
};

const DeploymentObservability = ({
  builds,
  viewLatestBuild = false,
  startIndex = 1,
  totalCount,
  dataUpdatedAt,
}: DeploymentObservabilityProps) => {
  const navigate = useNavigate();
  const scoped = useScopedPath();
  const actions = ["SAST", "SCA", "DAST"];
  const latestBuild = builds?.reduce((latest, current) => {
    if (!latest) return current;
    return new Date(current.createdDate) > new Date(latest.createdDate)
      ? current
      : latest;
  }, builds[0]);
  const latestBuildStatus = latestBuild?.status;

  // Subscribed to once, here, rather than inside each badge: the duration text needs the
  // same live status the badge shows, and a second subscription would be a second copy
  // of the same state to keep in step.
  const liveLatestStatus = useDeploymentStatus(latestBuild, latestBuildStatus);

  /** The status a row should present: live for the newest build, as fetched for the rest. */
  const statusOf = (build: IPipeline) =>
    latestBuild?.itemId === build.itemId ? liveLatestStatus : build.status;

  const handleActionClick = (
    action: string,
    repoId: string,
    buildId: string,
    event: React.MouseEvent,
  ) => {
    event.stopPropagation();
    navigate(
      scoped(
        `deployment/repo/${repoId}/deployment-logs/${buildId}?tab=${action.toLowerCase()}`,
      ),
    );
  };

  const handleDeployedItem = (repoId: string, buildId: string) => {
    navigate(
      scoped(
        `deployment/repo/${repoId}/deployment-logs/${buildId}?tab=deployment-logs`,
      ),
    );
  };

  const sortedBuilds = [...(builds || [])].sort(
    (a, b) =>
      new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime(),
  );

  // Every build handed in is rendered. Trimming the list here would silently drop rows the
  // caller already paid a request for, and it would make the footer's range a lie.
  const displayedBuilds = sortedBuilds;

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
              role="button"
              tabIndex={0}
              className="flex flex-col gap-3 px-1 py-4 hover:cursor-pointer hover:bg-secondary sm:flex-row sm:items-center sm:justify-between sm:gap-0"
              onClick={() => handleDeployedItem(build.repoId, build.itemId)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                if (event.target !== event.currentTarget) return;
                event.preventDefault();
                handleDeployedItem(build.repoId, build.itemId);
              }}>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-high-emphasis">
                    <div className="flex flex-wrap items-center gap-2 pb-2">
                      <span className="text-sm font-medium">
                        {build.eventName}
                      </span>
                      <DeploymentStatusBadge status={statusOf(build)} />
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
                    <BuildDuration
                      build={build}
                      status={statusOf(build)}
                      dataUpdatedAt={dataUpdatedAt}
                    />
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
            role="button"
            tabIndex={0}
            className="flex flex-col gap-3 px-1 py-4 hover:cursor-pointer hover:bg-secondary sm:flex-row sm:items-center sm:justify-between sm:gap-0"
            onClick={() => handleDeployedItem(build.repoId, build.itemId)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              if (event.target !== event.currentTarget) return;
              event.preventDefault();
              handleDeployedItem(build.repoId, build.itemId);
            }}>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">
                  <div className="flex flex-wrap items-center gap-2 pb-2">
                    <span className="text-sm font-medium">
                      {build.eventName}
                    </span>
                    <DeploymentStatusBadge status={statusOf(build)} />
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
                  <BuildDuration
                    build={build}
                    status={statusOf(build)}
                    dataUpdatedAt={dataUpdatedAt}
                  />
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
        {displayedBuilds.length === 0
          ? `Showing 0 of ${totalCount ?? 0} deploys`
          : `Showing ${startIndex}-${startIndex + displayedBuilds.length - 1} of ${totalCount ?? displayedBuilds.length} deploys`}
      </div>
    </div>
  );
};

export default DeploymentObservability;
