import { useEffect, useRef } from "react";
import { useT } from "@seliseblocks/genesis-os";
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
} from "@/cross-modules/identifier/hooks/use-project";
import { IProject } from "@/cross-modules/identifier/models/project.model";
import { useProjectStore } from "@/store/project.store";

const DEPLOYMENT_REPO_PATH = /^\/app\/deployment\/repo\/[^/]+$/;
const DEPLOYMENT_REPO_REDIRECT = "/app/deployment";

export function ProjectList() {
  const { t } = useT("release.shared");
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

  const handleProjectSelect = (project: IProject) => {
    if (DEPLOYMENT_REPO_PATH.test(pathname)) {
      pendingProjectRef.current = project;
      navigate(DEPLOYMENT_REPO_REDIRECT, { replace: true });
      return;
    }

    setSelectedProject(project);
  };

  const name = projectData?.data.name || selectedProject?.name;
  const projects = projectGroups
    .map((group) => group.projects[0])
    .filter(Boolean);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="w-full rounded-sm p-1 text-left hover:bg-accent hover:text-accent-foreground md:p-2">
        <div className="flex items-center justify-between gap-2">
          <div className="truncate text-sm font-medium">
            {name || t("PROJECT_LIST.SELECT_A_PROJECT")}
          </div>
          <ChevronDown className="h-4 w-4 shrink-0" />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-(--radix-dropdown-menu-trigger-width)">
        <DropdownMenuLabel>{t("PROJECT_LIST.YOUR_PROJECTS")}</DropdownMenuLabel>
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
                <span>{project.name}</span>
              )}
            </DropdownMenuItem>
          ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          {t("PROJECT_LIST.OVERVIEW_NOT_AVAILABLE")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
