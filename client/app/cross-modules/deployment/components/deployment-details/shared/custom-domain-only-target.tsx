import { DeploymentTargetLink } from "./deployment-target-link";

/**
 * The default domain of a deployment served on its custom domain alone: kept for reference, but
 * shown as not reachable, since nothing is deployed there.
 */
export const CustomDomainOnlyTarget = ({ url }: { url?: string }) => (
  <div data-testid="custom-domain-only-target">
    <DeploymentTargetLink isLive={false} url={url} />
    <span className="block text-xs text-low-emphasis">
      Not deployed: custom domain only
    </span>
  </div>
);

export default CustomDomainOnlyTarget;
