import { useProjectStore } from "@/store/project.store";
import { useGetProject } from "@blocks-identifier/hooks/use-project";
import { ProjectDetail } from "@/components/project-detail/project-detail";
import { ProjectRepoList } from "@/components/project-repo-list/project-repo-list";
import { ProjectCliSnippet } from "@/components/project-cli-snippet/project-cli-snippet";
import { GitCommandSnippet } from "@/components/git-command-snippet/git-command-snippet";

// Mirrors the uds Environment Overview layout (detail + repos + CLI + git
// snippets). The uds ActionsListProject (archive/edit-project) and cName
// validation are intentionally omitted to keep the port light.
export const DashboardOverview = () => {
  const itemId = useProjectStore().selectedProject?.itemId || "";
  const { data, isLoading } = useGetProject({ projectId: itemId });

  return (
    <main className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-xl font-semibold md:text-2xl">
          Environment Overview
        </h1>
      </div>
      <ProjectDetail project={data?.data} isLoading={isLoading} />
      <ProjectRepoList project={data?.data} isLoading={isLoading} />
      <ProjectCliSnippet />
      <GitCommandSnippet />
    </main>
  );
};
