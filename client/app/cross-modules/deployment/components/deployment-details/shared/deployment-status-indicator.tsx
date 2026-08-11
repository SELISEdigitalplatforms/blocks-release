import NotificationListener, {
  DeploymentStatusBadge,
} from "@blocks-deployment/components/deployment-details/shared/notification-listener";

interface DeploymentStatusIndicatorProps {
  hasLiveDeployment: boolean;
  latestBuild?: unknown;
  /** Status of the newest build, kept live through build notifications. */
  buildStatus?: string;
  /** Status recorded on the repository itself, e.g. "Deleted". */
  repoStatus?: string | null;
}

/**
 * Deployment status for a repository. While a deployment is live this tracks the newest build and
 * its notifications; once nothing is deployed the repo record is the only truth - listening for
 * build notifications there would resurrect the last build's "Succeeded" badge.
 */
export const DeploymentStatusIndicator = ({
  hasLiveDeployment,
  latestBuild,
  buildStatus,
  repoStatus,
}: DeploymentStatusIndicatorProps) => {
  if (!hasLiveDeployment) {
    return <DeploymentStatusBadge status={repoStatus || "NoBuild"} />;
  }

  return (
    <NotificationListener
      latestBuild={latestBuild}
      deploymentStatus={buildStatus}
    />
  );
};

export default DeploymentStatusIndicator;
