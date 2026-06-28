import { serviceInstances } from "@/lib/http-client";
import { CLOUD_BUILD_ENDPOINTS } from "@blocks-deployment/constants/endpoint.constant";

class ObservabilityService {
  private readonly httpClient = serviceInstances.deploymentService;
  async SASTData(buildId: string): Promise<string> {
    const url = `${CLOUD_BUILD_ENDPOINTS.REPORTS}?buildId=${encodeURIComponent(buildId)}&type=sast`;
    return this.httpClient.get(url);
  }
  async SCAData(buildId: string, type: string): Promise<string> {
    const url = `${CLOUD_BUILD_ENDPOINTS.REPORTS}?buildId=${encodeURIComponent(buildId)}&type=sca-${encodeURIComponent(type)}`;
    return this.httpClient.get(url);
  }
  async SCARedirect(buildId: string): Promise<string> {
    const url = `${CLOUD_BUILD_ENDPOINTS.PROCESS_DEPENDENCY_TRACK_USER}?buildId=${encodeURIComponent(buildId)}`;
    return this.httpClient.get(url);
  }
  async SASTRedirect(buildId: string): Promise<string> {
    const url = `${CLOUD_BUILD_ENDPOINTS.PROCESS_SONARQUBE_USER}?buildId=${encodeURIComponent(buildId)}`;
    return this.httpClient.get(url);
  }
}
export const observabilityService = new ObservabilityService();
