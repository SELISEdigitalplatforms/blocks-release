import { Pencil } from "lucide-react";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { Card, CardTitle } from "@/components/ui-kits/card/card";
import { IProject } from "@blocks-identifier/models/project.model";
import { Button } from "@/components/ui-kits/button/button";

// Lighter than the uds version: the edit-domain dialog (EditDomainForm) is not
// ported here. Repositories for a project are managed on the /deployment page.
export const ProjectRepoList = ({
  project,
  isLoading,
}: {
  project?: IProject;
  isLoading: boolean;
}) => {
  if (isLoading) {
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
        <div className="text-medium-emphasis">
          No repositories found for this project.
        </div>
      </div>
    </Card>
  );
};
