import { projectService } from "@/cross-modules/identifier/services/project.service";
import { useProjectStore } from "@/store/useProjectStore";
import { projectService as crossProjectService } from "@blocks-identifier/services/project.service";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

export const useGetProjects = (tenantGroupId = "") => {
  const setProjects = useProjectStore((state) => state.setProjects);
  const setSelectedProject = useProjectStore(
    (state) => state.setSelectedProject,
  );

  const query = useQuery({
    queryKey: ["identifier", "projects", tenantGroupId],
    queryFn: () => projectService.getProjects(0, 100, tenantGroupId),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (query.data) {
      const flattenedProjects = query.data.flatMap((group) => group.projects);
      const currentState = useProjectStore.getState();

      // Check if projects list actually changed before updating store
      const isListDifferent =
        currentState.projects.length !== flattenedProjects.length ||
        flattenedProjects.some(
          (p, i) => p.itemId !== currentState.projects[i]?.itemId,
        );

      if (isListDifferent) {
        setProjects(flattenedProjects);
      }

      // Only set initial project if none is selected
      if (!currentState.selectedProject && flattenedProjects.length > 0) {
        setSelectedProject(flattenedProjects[0]);
      }
    }
  }, [query.data, setProjects, setSelectedProject]);

  return query;
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
