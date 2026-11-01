/** What a repository or a build carries about the domains it deploys to. */
export interface IDomainTarget {
  customDeploymentUrl?: string | null;
  isCustomDomainOnly?: boolean | null;
}

/** True when a custom domain is set. "N/A" is the placeholder some views put in its place. */
export const hasCustomDomain = (target?: IDomainTarget | null): boolean => {
  const url = target?.customDeploymentUrl?.trim();
  return Boolean(url) && url !== "N/A";
};

/**
 * True when the deployment is served on the custom domain alone. Mirrors the server: the flag
 * only counts while a custom domain is set, otherwise the default domain is still deployed.
 */
export const isCustomDomainOnly = (target?: IDomainTarget | null): boolean =>
  Boolean(target?.isCustomDomainOnly) && hasCustomDomain(target);
