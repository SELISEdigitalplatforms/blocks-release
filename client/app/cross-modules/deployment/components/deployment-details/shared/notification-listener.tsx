import { useCallback, useState } from "react";
import { useNotificationListener } from "@blocks-communication/notification/hooks/use-notification-listener";
import { Badge } from "@/components/ui-kits/badge/badge";
import { getDeploymentLogEventBadgeClassName } from "@blocks-deployment/utils/deployment-logs.utils";

// Custom hook - handles all the notification logic
export const useDeploymentStatus = (
  latestBuild?: any,
  deploymentStatus: string = "NoBuild",
) => {
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [liveBuildId, setLiveBuildId] = useState<string | null>(null);
  const [hasReceivedUpdate, setHasReceivedUpdate] = useState(false);

  const handleNotification = useCallback(
    (notificationData: any) => {
      try {
        setHasReceivedUpdate(true);
        const denormalizedPayload = JSON.parse(
          notificationData.message.denormalizedPayload,
        );
        const message = denormalizedPayload.Message;
        const repoStatus = denormalizedPayload.RepoStatus;
        const buildStatus = repoStatus?.BuildStatus || message?.EventType;
        const buildId = message?.BuildId;

        if (buildId && latestBuild?.itemId && buildId === latestBuild.itemId) {
          setLiveStatus(buildStatus);
          setLiveBuildId(buildId);
        }
      } catch (error) {
        console.error("Failed to parse notification:", error);
      }
    },
    [latestBuild?.itemId],
  );

  useNotificationListener("BuildLogNotification", handleNotification);

  const displayStatus =
    hasReceivedUpdate && liveBuildId === latestBuild?.itemId && liveStatus
      ? liveStatus
      : deploymentStatus;

  return displayStatus;
};

// Presentational component - just renders the badge
export const DeploymentStatusBadge = ({ status }: { status: string }) => {
  return (
    <Badge className={getDeploymentLogEventBadgeClassName(status)}>
      {status}
    </Badge>
  );
};

// Main component - combines hook + badge
interface NotificationListenerProps {
  latestBuild?: any;
  deploymentStatus?: string;
}

const NotificationListener = ({
  latestBuild,
  deploymentStatus = "NoBuild",
}: NotificationListenerProps) => {
  const displayStatus = useDeploymentStatus(latestBuild, deploymentStatus);
  return <DeploymentStatusBadge status={displayStatus} />;
};

export default NotificationListener;
