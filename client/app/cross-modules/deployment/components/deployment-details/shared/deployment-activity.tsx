import { useState } from "react";
import { Link } from "react-router";
import { ArrowUpRight, X } from "lucide-react";
import ContributionSkyline from "@/components/ui/contribution-skyline";
import { Button } from "@/components/ui-kits/button/button";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { useScopedPath } from "@/hooks/use-scoped-path";
import { useDeploymentActivity } from "@blocks-deployment/hooks/use-deployment-activity";

export default function DeploymentActivity({
  repoId,
  branch,
  defaultView = "2d",
}: {
  repoId: string;
  branch: string;
  defaultView?: "2d" | "3d";
}) {
  const scoped = useScopedPath();
  const [endDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const { data, isPending, isError, isFetching, refetch } = useDeploymentActivity(
    repoId,
    branch,
    endDate,
  );

  if (isPending)
    return (
      <Skeleton aria-label="Loading deployment activity" className="mb-5 h-72 w-full rounded-sm" />
    );
  if (isError && !data)
    return (
      <div className="rounded-sm bg-surface-warm p-4">
        <p role="status" className="text-sm text-muted-foreground">
          Deployment activity is unavailable.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          disabled={isFetching}
          onClick={() => void refetch()}
        >
          {isFetching ? "Retrying…" : "Retry activity"}
        </Button>
      </div>
    );

  const dailyBuilds = selectedDay
    ? (data?.builds.filter((build) => build.createdDate.slice(0, 10) === selectedDay) ?? [])
    : [];
  const dateLabel = selectedDay
    ? new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(
        new Date(`${selectedDay}T00:00:00Z`),
      )
    : "";

  return (
    <div className="min-w-0 space-y-3">
      <ContributionSkyline
        data={data?.days ?? []}
        endDate={endDate}
        unit="deployment"
        defaultView={defaultView}
        palette="primary"
        appearance="minimal"
        title={
          data?.isPartial
            ? `${data.builds.length.toLocaleString()} recorded ${data.builds.length === 1 ? "deployment" : "deployments"}`
            : undefined
        }
        showStats={!data?.isPartial}
        onCellClick={(day) => setSelectedDay(day.date)}
      />
      <p className="text-xs text-muted-foreground">
        {data?.isPartial ? "Available deployment attempts" : "Deployment attempts"} on {branch} ·
        UTC · Select a day to view its deployments.
      </p>
      {selectedDay && (
        <section
          aria-label={`Deployments on ${dateLabel}`}
          className="rounded-sm bg-surface-warm p-4"
        >
          <div className="mb-2 flex items-center justify-between gap-3">
            <h4 className="text-sm font-semibold">
              {dailyBuilds.length} {dailyBuilds.length === 1 ? "deployment" : "deployments"} on{" "}
              {dateLabel}
            </h4>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              aria-label="Clear selected day"
              onClick={() => setSelectedDay(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          {!dailyBuilds.length ? (
            <p className="text-sm text-muted-foreground">No deployments on this day.</p>
          ) : (
            <ul className="space-y-1">
              {dailyBuilds.map((build) => (
                <li key={build.itemId}>
                  <Link
                    to={scoped(
                      `deployment/repo/${encodeURIComponent(repoId)}/deployment-logs/${encodeURIComponent(build.itemId)}?tab=deployment-logs`,
                    )}
                    className="flex flex-wrap items-center gap-2 rounded-md py-3 text-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="font-mono font-medium">{build.itemId.slice(0, 12)}</span>
                    <span className="text-muted-foreground">{build.status}</span>
                    <time
                      dateTime={build.createdDate}
                      className="ml-auto text-xs text-muted-foreground"
                    >
                      {new Intl.DateTimeFormat("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                        timeZone: "UTC",
                      }).format(new Date(build.createdDate))}{" "}
                      UTC
                    </time>
                    <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
