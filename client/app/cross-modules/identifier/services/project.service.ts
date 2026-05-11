import { http } from "@/lib/http-client";
import {
  CLOUD_BUILD_ENDPOINTS,
  PROJECT_ENDPOINTS,
} from "@blocks-identifier/constants/endpoint.constant";
import {
  IEnvRepository,
  IGetProjectPayload,
  IGetProjectResponse,
  IProjectGroup,
  IResource,
} from "@blocks-identifier/models/project.model";

export class ProjectService {
  getProjects(
    page: number,
    pageSize: number,
    tenantGroupId: string,
  ): Promise<IProjectGroup[]> {
    const url = `${PROJECT_ENDPOINTS.GETS}?page=${page}&pageSize=${pageSize}&tenantGroupId=${tenantGroupId}`;
    return http.get(url);
  }

  getProject(payload: IGetProjectPayload): Promise<IGetProjectResponse> {
    const url = `${PROJECT_ENDPOINTS.GET}?projectId=${payload.projectId}`;
    return http.get(url);
  }

  getEnvRepositories(projectKey: string): Promise<{
    data: IEnvRepository[];
    errors: unknown | null;
    isSuccess: boolean;
  }> {
    const url = `${CLOUD_BUILD_ENDPOINTS.REPOS_LIST}?projectkey=${projectKey}`;
    return http.get(url);
  }

  addAssets(payload: { tenantGroupId: string; resource: IResource }): Promise<{
    errors: unknown | null;
    isSuccess: boolean;
  }> {
    return http.post(PROJECT_ENDPOINTS.ADD_ASSET, payload);
  }
}

export const projectService = new ProjectService();
