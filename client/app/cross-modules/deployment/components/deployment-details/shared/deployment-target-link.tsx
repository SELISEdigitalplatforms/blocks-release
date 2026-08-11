import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button/copy-to-clipboard-button";

interface DeploymentTargetLinkProps {
  /** False once the deployment is gone: the host no longer resolves to anything. */
  isLive: boolean;
  url?: string;
}

/**
 * The address a repository deploys to. Only rendered as a link while something is actually serving
 * it - after a deletion the URL is kept for reference but must not look reachable.
 */
export const DeploymentTargetLink = ({
  isLive,
  url,
}: DeploymentTargetLinkProps) => {
  if (!isLive) {
    return (
      <span
        className="block truncate text-sm text-low-emphasis line-through"
        data-testid="deploys-to-inactive">
        {url || "N/A"}
      </span>
    );
  }

  return (
    <CopyToClipboardButton textToCopy={url || ""} isHoverable={false}>
      <a
        href={url || "#"}
        target="_blank"
        rel="noopener noreferrer"
        className="block truncate text-sm text-primary hover:underline"
        onClick={(e) => e.stopPropagation()}>
        {url || "N/A"}
      </a>
    </CopyToClipboardButton>
  );
};

export default DeploymentTargetLink;
