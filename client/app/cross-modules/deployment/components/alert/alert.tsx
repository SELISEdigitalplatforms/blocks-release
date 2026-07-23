import { Button } from "@/components/ui-kits/button/button";
import { Card, CardContent, CardHeader } from "@/components/ui-kits/card/card";
import { useGetMonitorListById } from "@/cross-modules/deployment/hooks/use-alerts";
import { useProjectStore } from "@/store/project.store";
import { useDeploymentStatus } from "@blocks-deployment/components/deployment-details/shared/notification-listener";
import { ExternalLink } from "lucide-react";
import { AlertsList } from "./alerts-list";
import { getRuntimeEnv } from "@/lib/runtime-env";

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

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col items-start justify-between sm:flex-row sm:items-center">
          <span className="p-2 text-xl font-semibold leading-none">
            Monitoring
          </span>
          <div className="flex h-10 items-center justify-end gap-4 rounded text-base">
            <Button
              onClick={() =>
                window.open(
                  `${getRuntimeEnv("BLOCKS_MONITOR_BASE_URL")}`,
                  "_blank",
                )
              }
              className="h-9 gap-2"
              disabled={
                buildLength <= 0 ||
                (build !== "Succeeded" && build !== "Failed")
              }>
              <ExternalLink className="h-4 w-4" />
              Manage Monitors
            </Button>
          </div>
        </div>
      </CardHeader>
      {buildLength > 1 || build === "Succeeded" || build === "Failed" ? (
        <CardContent>
          <AlertsList data={data?.data || []} isLoading={isLoading} />
        </CardContent>
      ) : (
        <div className="flex h-20 items-center justify-center">
          Please deploy your project to begin populating this section
        </div>
      )}
    </Card>
  );
};

export default Alert;
