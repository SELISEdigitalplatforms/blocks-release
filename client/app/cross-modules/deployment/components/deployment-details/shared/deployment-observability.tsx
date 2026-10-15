import React, { useEffect, useRef, useState } from "react";
import { ChevronRight } from "lucide-react";
import DeploymentSteps, { BuildStageIcon } from "./deployment-steps";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui-kits/button/button";
import { useNavigate } from "react-router";
import {
  getBuildDurationLabel,
  isLiveBuildStatus,
} from "@blocks-deployment/utils/deployment-logs.utils";
import { IPipeline } from "@blocks-deployment/pages/repo-details";
import { DeploymentStatusBadge, useDeploymentStatus } from "./notification-listener";
import { OUTLINE_BUTTON_CLASS } from "./surface-styles";
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
    new Date(build.lastUpdatedDate).getTime() - new Date(build.createdDate).getTime();

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
    return new Date(current.createdDate) > new Date(latest.createdDate) ? current : latest;
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
      scoped(`deployment/repo/${repoId}/deployment-logs/${buildId}?tab=${action.toLowerCase()}`),
    );
  };

  const handleDeployedItem = (repoId: string, buildId: string) => {
    navigate(scoped(`deployment/repo/${repoId}/deployment-logs/${buildId}?tab=deployment-logs`));
  };

  const sortedBuilds = [...(builds || [])].sort(
    (a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime(),
  );

  // Every build handed in is rendered. Trimming the list here would silently drop rows the
  // caller already paid a request for, and it would make the footer's range a lie.
  const displayedBuilds = sortedBuilds;

  const renderActionIcon = (action: string) => {
    switch (action) {
      case "SAST":
        return <img src={SASTLogo} width={16} height={16} alt="SAST logo" className="h-4 w-4" />;
      case "SCA":
        return <img src={SCALogo} width={16} height={16} alt="SCA logo" className="h-4 w-4" />;
      case "DAST":
        return <img src={DASTLogo} width={12} height={12} alt="DAST logo" className="h-3 w-3" />;
      default:
        return null;
    }
  };
  const rows = viewLatestBuild ? (latestBuild ? [latestBuild] : []) : displayedBuilds;
  return (
    <div className="min-w-0">
      <div className="space-y-1">
        {rows.map((build) => (
          <div
            key={build.itemId}
            role="button"
            tabIndex={0}
            className={cn(
              "group cursor-pointer rounded-sm p-4 transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
              "bg-primary/[0.04] transition-[background-color,box-shadow] hover:bg-surface-warm hover:shadow-[0_0_0_1px_hsl(var(--primary)/0.35)]",
            )}
            onClick={() => handleDeployedItem(build.repoId, build.itemId)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              if (event.target !== event.currentTarget) return;
              event.preventDefault();
              handleDeployedItem(build.repoId, build.itemId);
            }}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-start gap-2.5">
                <BuildStageIcon buildId={build.itemId} events={build.events} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start gap-1">
                    <span className="text-sm font-medium leading-6 text-high-emphasis">
                      {build.eventName}
                    </span>
                    <DeploymentStatusBadge
                      status={statusOf(build)}
                      className="px-1.5 py-0 text-[10px] leading-4"
                    />
                  </div>
                  <p className="break-all font-mono text-[11px] text-muted-foreground">
                    ID: {build.itemId}
                  </p>
                  {build.events?.length > 0 && (
                    <div className="mt-3 max-w-lg">
                      <DeploymentSteps buildId={build.itemId} events={build.events} />
                    </div>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center justify-between gap-3 pl-[2.125rem] sm:pl-0">
                <div className="text-xs text-muted-foreground sm:text-right">
                  <div className="font-medium text-high-emphasis">
                    {formatFullDate(new Date(build.createdDate))}
                  </div>
                  <div className="mt-1">
                    <BuildDuration
                      build={build}
                      status={statusOf(build)}
                      dataUpdatedAt={dataUpdatedAt}
                    />
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-1 sm:justify-end">
                    {actions.map((action) => (
                      <Button
                        key={action}
                        variant="outline"
                        size="xs"
                        className={cn(
                          OUTLINE_BUTTON_CLASS,
                          "gap-1.5 px-2.5 text-xs text-high-emphasis hover:border-primary/40 hover:bg-primary/[0.07] hover:text-primary",
                        )}
                        onClick={(event) =>
                          handleActionClick(action, build.repoId, build.itemId, event)
                        }
                      >
                        {renderActionIcon(action)}
                        <span>{action}</span>
                      </Button>
                    ))}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-muted-foreground group-hover:text-primary"
                  aria-label={`Open deployment ${build.itemId}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    handleDeployedItem(build.repoId, build.itemId);
                  }}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {!viewLatestBuild && (
        <p className="mt-3 px-3 text-xs text-muted-foreground">
          {displayedBuilds.length === 0
            ? `Showing 0 of ${totalCount ?? 0} deploys`
            : `Showing ${startIndex}-${startIndex + displayedBuilds.length - 1} of ${totalCount ?? displayedBuilds.length} deploys`}
        </p>
      )}
    </div>
  );
};

export default DeploymentObservability;
