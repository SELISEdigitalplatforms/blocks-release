import { serviceInstances } from "@/lib/http-client";
import { CLOUD_BUILD_ENDPOINTS } from "@blocks-deployment/constants/endpoint.constant";
import { IBuildApiResponse } from "@blocks-deployment/models/deployed-logs";
import {
  IBranch,
  IBranchMatchResponse,
  ICloneRepo,
  IRepository,
  IRepositoryUser,
} from "@blocks-deployment/models/github-info";
import {
  CardRepoAndBranchesResponse,
  IChangeRepoSpecs,
  IChangeSettings,
  IManualDeploymentPayload,
} from "@blocks-deployment/models/utils";

export class GithubInfoService {
  private readonly httpClient = serviceInstances.deploymentService;
  async verifyAuthorization(code: string, projectKey: string): Promise<string> {
    const url = `${CLOUD_BUILD_ENDPOINTS.ACCESS_TOKEN}?code=${encodeURIComponent(code)}`;
    return this.httpClient.get(url);
  }

  async checkAlreadyAuthorization(): Promise<{
    isSuccess: boolean;
  }> {
    const url = CLOUD_BUILD_ENDPOINTS.IS_AUTHORIZED;
    return this.httpClient.get(url);
  }

  async revokeAccess(): Promise<{
    isSuccess: boolean;
  }> {
    const url = CLOUD_BUILD_ENDPOINTS.REMOVE_AUTHORIZATION;
    return this.httpClient.post(url, {});
  }

  async removeAuthorization(): Promise<{
    isSuccess: boolean;
  }> {
    const url = CLOUD_BUILD_ENDPOINTS.REMOVE_ACCESS_TOKEN;
    return this.httpClient.post(url, {});
  }

  async getGithubRepos(
    search?: string,
    pageNumber?: number,
    pageSize?: number,
  ): Promise<{
    data: {
      items: IRepository[];
      total_count: number;
    };
    message: string | null;
    statusCode: number;
    errors: unknown;
    isSuccess: boolean;
  }> {
    const params = [
      search ? `search=${encodeURIComponent(search)}` : "",
      pageNumber ? `pageNumber=${pageNumber}` : "",
      pageSize ? `pageSize=${pageSize}` : "",
    ]
      .filter(Boolean)
      .join("&");
    const url = params
      ? `${CLOUD_BUILD_ENDPOINTS.GITHUB_REPOS}?${params}`
      : CLOUD_BUILD_ENDPOINTS.GITHUB_REPOS;
    return this.httpClient.get(url);
  }

  async getRepositoryUser(): Promise<IRepositoryUser> {
    return this.httpClient.get(CLOUD_BUILD_ENDPOINTS.GITHUB_USER);
  }

  async getGithubBranches(repo: string): Promise<IBranch[]> {
    const url = `${CLOUD_BUILD_ENDPOINTS.GITHUB_BRANCHES}?repo=${encodeURIComponent(repo)}`;
    return this.httpClient.get(url);
  }

  async getRepoAndGitBranchMatch(
    repoId: string,
  ): Promise<IBranchMatchResponse> {
    const url = `${CLOUD_BUILD_ENDPOINTS.GITHUB_BRANCH_EXISTS}?repoId=${encodeURIComponent(repoId)}`;
    return this.httpClient.get(url);
  }

  async cloneGithubRepo(payload: ICloneRepo) {
    const url = CLOUD_BUILD_ENDPOINTS.BUILD_BUILD;
    return this.httpClient.post<any>(url, payload);
  }

  async repoInitialDeploy(payload: any) {
    const url = CLOUD_BUILD_ENDPOINTS.RUN_BUILD;
    return this.httpClient.post<any>(url, payload);
  }

  async manualDeploy(payload: IManualDeploymentPayload) {
    const url = CLOUD_BUILD_ENDPOINTS.MANUAL;
    return this.httpClient.post<any>(url, payload);
  }

  async getSpecs() {
    const url = CLOUD_BUILD_ENDPOINTS.SETTINGS;
    return this.httpClient.get(url);
  }

  async getAllRepos(
    projectKey: string,
  ): Promise<CardRepoAndBranchesResponse[]> {
    const url = `${CLOUD_BUILD_ENDPOINTS.REPOS}?ProjectKey=${encodeURIComponent(projectKey)}`;
    return this.httpClient.get(url);
  }

  async getAllRepoBuilds(projectKey: string): Promise<any> {
    const url = `${CLOUD_BUILD_ENDPOINTS.REPOS}?ProjectKey=${encodeURIComponent(projectKey)}`;
    return this.httpClient.get(url);
  }

  async getAllProjects(): Promise<any> {
    return this.httpClient.get(CLOUD_BUILD_ENDPOINTS.REPOS_LIST);
  }

  async getRepoDetails(repoId: string): Promise<any> {
    const url = `${CLOUD_BUILD_ENDPOINTS.REPO_DETAILS}?RepoId=${encodeURIComponent(repoId)}`;
    return this.httpClient.get(url);
  }

  async getCardRepoAndBranches(buildId: string): Promise<IBuildApiResponse> {
    const url = `${CLOUD_BUILD_ENDPOINTS.BUILD}?buildId=${encodeURIComponent(buildId)}`;
    return this.httpClient.get(url);
  }

  async changeBuildSpecs(payload: IChangeSettings) {
    const url = CLOUD_BUILD_ENDPOINTS.BUILD;
    return this.httpClient.put(url, payload);
  }

  async updateRepoSettings(payload: IChangeRepoSpecs) {
    const url = CLOUD_BUILD_ENDPOINTS.REPO_SETTINGS_UPDATE;
    return this.httpClient.post(url, payload);
  }

  async getBuildLogs(
    repoId: string,
    projectKey: string,
  ): Promise<IBuildApiResponse> {
    const url = `${CLOUD_BUILD_ENDPOINTS.RUN_BUILD}?repoId=${repoId}&ProjectKey=${encodeURIComponent(projectKey)}`;
    return this.httpClient.get(url);
  }

  async getRepoCardsAndBranches(): Promise<CardRepoAndBranchesResponse> {
    return this.httpClient.get(CLOUD_BUILD_ENDPOINTS.GITHUB_REPOS);
  }
}

export const githubInfoService = new GithubInfoService();
