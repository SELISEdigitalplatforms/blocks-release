import type {
  IAddSingleMonitorResponse,
  IAlertResponse,
  IDeleteHealthResponse,
  IGetMonitorList,
  ISaveSingleHealthResponse,
  IUpdateHealth,
  IUpdateSingleMonitorPayload,
} from "@/cross-modules/deployment/models/alerts.model";
import { serviceInstances } from "@/lib/http-client";
import { ALERT_ENDPOINTS } from "@blocks-deployment/constants/endpoint.constant";

class AlertsService {
  private readonly httpClient = serviceInstances.logicService;

  async updateSingleMonitor(payload: Partial<IUpdateSingleMonitorPayload>) {
    const url = ALERT_ENDPOINTS.UPDATE_MONITOR;
    return this.httpClient.post<IAlertResponse<IAddSingleMonitorResponse>>(
      url,
      payload,
    );
  }

  async deleteSingleMonitor(itemId: string) {
    const url = `${ALERT_ENDPOINTS.DELETE_MONITOR}?itemId=${encodeURIComponent(itemId)}`;
    return this.httpClient.delete<IAlertResponse<null>>(url);
  }

  async getMonitorListById(projectKey: string, repoId: string) {
    const url = `${ALERT_ENDPOINTS.GET_MONITOR_LIST_BY_REPO_ID}?ProjectKey=${encodeURIComponent(projectKey)}&repoId=${repoId}`;
    return this.httpClient.get<IGetMonitorList>(url);
  }

  async updateHealth(payload: Partial<IUpdateHealth>) {
    const url = ALERT_ENDPOINTS.UPDATE_HEALTH;
    return this.httpClient.post<ISaveSingleHealthResponse>(url, payload);
  }

  async deleteHealth(itemId: string) {
    const url = `${ALERT_ENDPOINTS.DELETE_HEALTH}?itemId=${encodeURIComponent(itemId)}`;
    return this.httpClient.delete<IDeleteHealthResponse>(url);
  }
}
export const alertsService = new AlertsService();
