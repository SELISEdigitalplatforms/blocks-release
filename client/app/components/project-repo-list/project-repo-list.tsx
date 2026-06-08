import { Pencil } from "lucide-react";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { Card, CardTitle } from "@/components/ui-kits/card/card";
import { IProject } from "@blocks-identifier/models/project.model";
import { Button } from "@/components/ui-kits/button/button";
import { useProjectStore } from "@/store/project.store";
import { useGetAllProjects } from "@blocks-deployment/hooks/use-github-info";
import type { IRepoResponse } from "@blocks-deployment/components/deployment-home/repo-cards/repo-cards";

// Lighter than the uds version: the edit-domain dialog (EditDomainForm) is not
// ported here. The repository list is fetched from the deployment repos-list
// endpoint (scoped to the selected project's tenant).
export const ProjectRepoList = ({
  project,
  isLoading,
}: {
  project?: IProject;
  isLoading: boolean;
}) => {
  const projectKey = useProjectStore().selectedProject?.tenantId || "";
  const { data: reposResponse, isPending: isReposLoading } = useGetAllProjects(
    {
      refetchOnMount: true,
      refetchOnWindowFocus: false,
      forceRefresh: true,
    },
    projectKey,
  );
  const repositories: IRepoResponse[] = reposResponse?.data ?? [];

  if (isLoading || isReposLoading) {
    return (
      <div className="mt-6 rounded-lg border bg-card px-2 py-2 shadow-sm md:mt-0">
        <div className="grid-col-1 grid gap-3 px-2 py-4 md:grid-cols-2 md:gap-4 lg:gap-6">
          {Array.from({ length: 6 }).map((_item, index) => (
            <div key={index}>
              <Skeleton className="h-5 w-1/2" />
              <Skeleton className="mt-2 h-5 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <Card className="mt-6 border bg-card px-4 py-4 shadow-sm md:mt-0">
      <div className="mt-2 flex items-center justify-between">
        <CardTitle>Repositories</CardTitle>
        <Button
          disabled={!project?.customDomain || project?.customDomain === ""}
          variant="outline"
        >
          <Pencil className="mr-2 h-3.5 w-3.5" />
          Edit domain
        </Button>
      </div>
      <div className="mt-4">
        {repositories.length === 0 ? (
          <div className="text-medium-emphasis">
            No repositories found for this project.
          </div>
        ) : (
          <ul className="divide-y">
            {repositories.map((repo) => (
              <li
                key={repo.itemId}
                className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0"
              >
                <span className="font-medium">
                  {repo.repoName?.split("/").pop() || repo.repoName}
                </span>
                {repo.repoUrl && (
                  <a
                    href={repo.repoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate text-sm text-blue-600 hover:underline"
                  >
                    {repo.repoUrl}
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
};
