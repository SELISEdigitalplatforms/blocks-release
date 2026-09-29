import { useEffect, useMemo, useRef } from "react";
import { ChevronDown, Loader } from "lucide-react";
import { useLocation, useNavigate } from "react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui-kits/dropdown-menu/dropdown-menu";
import {
  useGetProject,
  useGetProjects,
} from "@blocks-identifier/hooks/use-project";
import { IProject } from "@blocks-identifier/models/project.model";
import { useProjectStore } from "@/store/project.store";

const DEPLOYMENT_REPO_PATH = /^\/app\/deployment\/repo\/[^/]+$/;
const DEPLOYMENT_REPO_REDIRECT = "/app/deployment";

export function EnvironmentList() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { data: projectGroups = [], isLoading } = useGetProjects({});
  const selectedProject = useProjectStore((state) => state.selectedProject);
  const setSelectedProject = useProjectStore(
    (state) => state.setSelectedProject,
  );
  const { data: projectData } = useGetProject({
    projectId: selectedProject?.itemId || "",
  });
  const pendingProjectRef = useRef<IProject | null>(null);


  useEffect(() => {
    if (pendingProjectRef.current) {
      setSelectedProject(pendingProjectRef.current);
      pendingProjectRef.current = null;
    }
  }, [pathname, setSelectedProject]);

  useEffect(() => {
    if (
      projectData?.data &&
      selectedProject &&
      selectedProject.itemId === projectData.data.itemId &&
      // Only update if there are meaningful changes to avoid loops
      (selectedProject.name !== projectData.data.name ||
        selectedProject.applications?.[0]?.domain !==
          projectData.data.applications?.[0]?.domain ||
        selectedProject.environment !== projectData.data.environment)
    ) {
      setSelectedProject(projectData.data);
    }
  }, [projectData?.data, selectedProject, setSelectedProject]);

  const handleProjectSelect = (project: IProject) => {
    if (DEPLOYMENT_REPO_PATH.test(pathname)) {
      pendingProjectRef.current = project;
      navigate(DEPLOYMENT_REPO_REDIRECT, { replace: true });
      return;
    }

    setSelectedProject(project);
  };

  const environment =
    projectData?.data.environment || selectedProject?.environment;
  const applicationDomain =
    projectData?.data.applications?.[0]?.domain ||
    selectedProject?.applications?.[0]?.domain;

  const projects = useMemo(() => {
    if (!selectedProject) return [];
    const groupWithSelected = projectGroups.find((group) =>
      group.projects.some(
        (project) => project.itemId === selectedProject.itemId,
      ),
    );
    return groupWithSelected ? groupWithSelected.projects : [];
  }, [projectGroups, selectedProject]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="w-full rounded-sm py-1 text-left hover:bg-accent hover:text-accent-foreground md:p-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 flex-col md:items-end">
            {environment ? (
              <div className="w-fit rounded-sm bg-[hsl(var(--blocks-primary-50))] px-2 text-[12px] font-semibold text-[hsl(var(--high-emphasis))]">
                {environment}
              </div>
            ) : (
              <span className="text-sm">Select an Environment</span>
            )}
            <small className="mt-1 w-full max-w-[150px] truncate text-left text-xs text-muted-foreground md:text-right">
              {applicationDomain || "No domain selected"}
            </small>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0" />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[--radix-dropdown-menu-trigger-width]">
        <DropdownMenuLabel>Your Environments</DropdownMenuLabel>
        {projects
          .filter((project) => project.itemId !== selectedProject?.itemId)
          .slice(0, 5)
          .map((project) => (
            <DropdownMenuItem
              key={project.itemId}
              onSelect={() => handleProjectSelect(project)}>
              {isLoading ? (
                <div className="flex w-full items-center justify-center py-2">
                  <Loader size={16} className="animate-spin text-gray-400" />
                </div>
              ) : (
                <span>{project.environment}</span>
              )}
            </DropdownMenuItem>
          ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          Environment overview is not part of this client
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
