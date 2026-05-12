import { serviceInstances } from "@/lib/http-client";
import { CLOUD_BUILD_ENDPOINTS } from "@blocks-deployment/constants/endpoint.constant";

class ObservabilityService {
  private readonly httpClient = serviceInstances.deploymentService;
  async SASTData(buildId: string, projectKey: string): Promise<string> {
    const url = `${CLOUD_BUILD_ENDPOINTS.REPORTS}?buildId=${encodeURIComponent(buildId)}&type=sast&ProjectKey=${encodeURIComponent(projectKey)}`;
    return this.httpClient.get(url);
  }
  async SCAData(
    buildId: string,
    projectKey: string,
    type: string,
  ): Promise<string> {
    const url = `${CLOUD_BUILD_ENDPOINTS.REPORTS}?buildId=${encodeURIComponent(buildId)}&type=sca-${encodeURIComponent(type)}&ProjectKey=${encodeURIComponent(projectKey)}`;
    return this.httpClient.get(url);
  }
  async SCARedirect(buildId: string, projectKey: string): Promise<string> {
    const url = `${CLOUD_BUILD_ENDPOINTS.PROCESS_DEPENDENCY_TRACK_USER}?ProjectKey=${encodeURIComponent(projectKey)}&buildId=${encodeURIComponent(buildId)}`;
    return this.httpClient.get(url);
  }
  async SASTRedirect(buildId: string, projectKey: string): Promise<string> {
    const url = `${CLOUD_BUILD_ENDPOINTS.PROCESS_SONARQUBE_USER}?ProjectKey=${encodeURIComponent(projectKey)}&buildId=${encodeURIComponent(buildId)}`;
    return this.httpClient.get(url);
  }
}
export const observabilityService = new ObservabilityService();
