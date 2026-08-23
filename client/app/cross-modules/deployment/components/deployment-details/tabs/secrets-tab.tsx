import { Card, CardContent, CardHeader } from "@/components/ui-kits/card/card";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { lazy, Suspense } from "react";

/**
 * Loaded on demand.
 *
 * The panel pulls in the form stack — schema validation, field arrays, the modals — which only
 * matters once someone opens this tab. Importing it eagerly would put all of that in the
 * repository-details route's graph for every visitor, most of whom never leave the Details tab.
 */
const RepoSecretsPanel = lazy(() =>
  import("@blocks-deployment/components/repo-secrets/repo-secrets-panel").then(
    (module) => ({ default: module.RepoSecretsPanel }),
  ),
);

type SecretsTabProps = {
  repoId?: string;
  repoName?: string;
};

/** Mirrors the panel's own layout so the swap from chunk-loading to loaded does not jump. */
const SecretsTabFallback = () => (
  <Card data-testid="secrets-tab-loading">
    <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-9 w-64" />
    </CardHeader>
    <CardContent className="flex flex-col gap-3">
      <Skeleton className="h-5 w-56" />
      <Skeleton className="h-5 w-72" />
    </CardContent>
  </Card>
);

/**
 * Secrets tab body.
 *
 * Renders nothing until the repository id is known — the panel's queries are guarded on it, and
 * mounting without one would only produce a disabled query and an empty card.
 */
export const SecretsTab = ({ repoId, repoName }: SecretsTabProps) => {
  if (!repoId) return null;

  return (
    <Suspense fallback={<SecretsTabFallback />}>
      <RepoSecretsPanel repoId={repoId} repoName={repoName} />
    </Suspense>
  );
};

export default SecretsTab;
