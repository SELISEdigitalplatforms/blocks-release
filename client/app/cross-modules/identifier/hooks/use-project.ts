import { projectService } from "@/cross-modules/identifier/services/project.service";
import { useProjectStore } from "@/store/useProjectStore";
import { projectService as crossProjectService } from "@blocks-identifier/services/project.service";
import { useQuery } from "@tanstack/react-query";

export const useGetProjects = (tenantGroupId = "") => {
  const { setProjects, selectedProject, setSelectedProject } =
    useProjectStore();

  return useQuery({
    queryKey: ["identifier", "projects", tenantGroupId],
    queryFn: () => projectService.getProjects(0, 100, tenantGroupId),
    staleTime: 5 * 60 * 1000, // 5 minutes - prevent unnecessary re-fetches during navigation
    select: (data) => {
      const flattenedProjects = data.flatMap((group) => group.projects);
      setProjects(flattenedProjects);
      if (!selectedProject && flattenedProjects.length > 0) {
        setSelectedProject(flattenedProjects[0]);
      }
      return data;
    },
  });
};

export const useGetProject = (options: { projectId: string }) => {
  return useQuery({
    queryKey: ["identifier", "project", options],
    queryFn: () => projectService.getProject(options),
    enabled: Boolean(options.projectId),
  });
};

export const useGetEnvRepositories = (projectKey: string) => {
  return useQuery({
    queryKey: ["env-repositories", projectKey],
    queryFn: () => crossProjectService.getEnvRepositories(projectKey),
  });
};
