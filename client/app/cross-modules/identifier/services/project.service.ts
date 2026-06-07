import { serviceInstances } from "@/lib/http-client";
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
  private readonly httpClient = serviceInstances.deploymentService;
  // TEMP: route project reads through the logic app while the deployment-side
  // impersonation/cookie 401 is being fixed. Revert to `httpClient` once fixed.
  private readonly logicClient = serviceInstances.logicService;

  getProjects(
    page: number,
    pageSize: number,
    tenantGroupId: string,
  ): Promise<IProjectGroup[]> {
    const url = `${PROJECT_ENDPOINTS.GETS}?page=${page}&pageSize=${pageSize}&tenantGroupId=${tenantGroupId}`;
    return this.logicClient.get(url);
  }

  getProject(payload: IGetProjectPayload): Promise<IGetProjectResponse> {
    const url = `${PROJECT_ENDPOINTS.GET}?projectId=${payload.projectId}`;
    return this.logicClient.get(url);
  }

  getEnvRepositories(projectKey: string): Promise<{
    data: IEnvRepository[];
    errors: unknown | null;
    isSuccess: boolean;
  }> {
    const url = `${CLOUD_BUILD_ENDPOINTS.REPOS_LIST}?projectkey=${projectKey}`;
    return this.httpClient.get(url);
  }

  addAssets(payload: { tenantGroupId: string; resource: IResource }): Promise<{
    errors: unknown | null;
    isSuccess: boolean;
  }> {
    // Project management is owned by the logic app, not the deployment API
    // (the deployment backend no longer hosts a Project controller).
    return this.logicClient.post(PROJECT_ENDPOINTS.ADD_ASSET, payload);
  }
}

export const projectService = new ProjectService();
