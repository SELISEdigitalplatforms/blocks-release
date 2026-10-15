import { Button } from "@/components/ui-kits/button/button";
import { useGetMonitorListById } from "@/cross-modules/deployment/hooks/use-alerts";
import { useProjectStore } from "@/store/project.store";
import { useDeploymentStatus } from "@blocks-deployment/components/deployment-details/shared/notification-listener";
import { ExternalLink } from "lucide-react";
import { AlertsList } from "./alerts-list";
import { getRuntimeEnv } from "@/lib/runtime-env";
import { cn } from "@/lib/utils";
import { OUTLINE_BUTTON_CLASS } from "@blocks-deployment/components/deployment-details/shared/surface-styles";

const Alert = ({
  repoId,
  latestBuild,
  status,
  buildLength,
}: {
  repoId: string;
  latestBuild: unknown;
  status: string;
  buildLength: number;
}) => {
  const build = useDeploymentStatus(latestBuild, status);
  const projectKey = useProjectStore()?.selectedProject?.tenantId || "";
  const { data, isLoading } = useGetMonitorListById(projectKey, repoId);
  const hasDeployment = buildLength > 1 || build === "Succeeded" || build === "Failed";

  return (
    <section aria-labelledby="repository-monitoring-title">
      {/* Same header treatment as the Domains table: small caps title, inline description. */}
      <div className="mb-2 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <h2
            id="repository-monitoring-title"
            className="text-[13px] font-bold uppercase tracking-[0.06em] text-high-emphasis"
          >
            Monitoring
          </h2>
          <p className="text-[13px] text-muted-foreground">
            Availability and incidents for this repository
          </p>
        </div>
        <Button
          onClick={() =>
            window.open(
              `${getRuntimeEnv("BLOCKS_MONITOR_BASE_URL")}`,
              "_blank",
              "noopener,noreferrer",
            )
          }
          variant="outline"
          size="sm"
          className={cn(OUTLINE_BUTTON_CLASS, "gap-2")}
          disabled={buildLength <= 0 || (build !== "Succeeded" && build !== "Failed")}
        >
          <ExternalLink className="h-4 w-4" />
          Manage Monitors
        </Button>
      </div>
      {/* The table draws its own card, so it is not wrapped in a second, padded one. */}
      {hasDeployment && (isLoading || data?.data?.length) ? (
        <AlertsList data={data?.data || []} isLoading={isLoading} />
      ) : (
        <div className="rounded-sm bg-card px-5 py-6 shadow-surface-ring sm:px-8 sm:py-8">
          <p className="text-sm text-muted-foreground">
            {hasDeployment
              ? "No monitors configured for this repository. Add one to track availability and incidents."
              : "Please deploy your project to begin populating this section"}
          </p>
        </div>
      )}
    </section>
  );
};

export default Alert;
