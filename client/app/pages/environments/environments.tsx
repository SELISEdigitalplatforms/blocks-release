import { EnvironmentCard } from "@seliseblocks/blocks-kit";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { useGetProjects } from "@blocks-identifier/hooks/use-project";
import { useProjectStore } from "@/store/project.store";

const EnvironmentsLoading = () => (
  <main className="flex flex-1 flex-col gap-4 p-6 md:gap-6">
    <Skeleton className="mb-2 h-8 w-40" />
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array(8)
        .fill(1)
        .map((_, index) => (
          <Skeleton key={index} className="h-[160px] w-full rounded-xl" />
        ))}
    </div>
  </main>
);

// Lighter than the uds EnvironmentsPage: reuses blocks-kit's EnvironmentCard and
// deployment's existing useGetProjects. The add-environment modal and migration
// status (which need backend support not present here) are omitted.
export const EnvironmentsPage = () => {
  const groupId = useProjectStore((state) => state.selectedTenantGroup);
  const { data: projectGroups = [], isLoading } = useGetProjects({
    tenantGroupId: groupId ?? "",
  });

  const projects = projectGroups.flatMap((group) => group.projects);

  if (isLoading) {
    return <EnvironmentsLoading />;
  }

  return (
    <main className="flex flex-1 flex-col gap-4 p-6 md:gap-6">
      <div className="mb-2 flex flex-row justify-between">
        <h4 className="text-lg font-semibold md:text-xl">Environments</h4>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-md border py-12 text-center text-sm text-muted-foreground md:text-base">
          No environments found in this project.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {projects.map((project) => (
            <EnvironmentCard
              key={project.itemId}
              project={project}
              isMigrationOngoing={false}
            />
          ))}
        </div>
      )}
    </main>
  );
};
